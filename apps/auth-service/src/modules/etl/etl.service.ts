import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  EtlPipelineConfig,
  EtlJob,
  EtlRecord,
  QualityGateResult,
} from '@hotel-crm/shared';

import { DataQualityGateService } from '../data-quality/data-quality-gate.service';
import { QualityMetricsService } from '../data-quality/quality-metrics.service';
import { BusinessRulesEngineService } from '../data-quality/business-rules-engine.service';

import { DataIngestionService } from './data-ingestion.service';
import { EventTimeProcessorService } from './event-time-processor.service';
import { WatermarkingService } from './watermarking.service';
import { DeduplicationService } from './deduplication.service';
import { BatchProcessorService } from './batch-processor.service';
import { StreamingProcessorService } from './streaming-processor.service';
import { EtlRepositoryPort } from './domain/ports/etl-repository.port';

@Injectable()
export class EtlService implements OnModuleInit {
  private readonly logger = new Logger(EtlService.name);
  private activePipelines = new Map<string, EtlPipelineConfig>();
  private activeJobs = new Map<string, EtlJob>();
  private processingQueues = new Map<string, EtlRecord[]>();

  constructor(
    private readonly dataIngestion: DataIngestionService,
    private readonly eventTimeProcessor: EventTimeProcessorService,
    private readonly watermarking: WatermarkingService,
    private readonly deduplication: DeduplicationService,
    private readonly batchProcessor: BatchProcessorService,
    private readonly streamingProcessor: StreamingProcessorService,
    private readonly dataQualityGate: DataQualityGateService,
    private readonly qualityMetrics: QualityMetricsService,
    private readonly businessRulesEngine: BusinessRulesEngineService,
    private readonly etlRepository: EtlRepositoryPort,
  ) {}

  async onModuleInit() {
    await this.initializeDataQualityFramework();
    await this.initializeDefaultPipelines();
    this.startBackgroundProcessing();
  }

  private async initializeDataQualityFramework(): Promise<void> {
    try {
      this.dataQualityGate.registerHotelCrmSchemas();
      this.businessRulesEngine.registerHotelCrmRules();
      this.dataQualityGate.registerHotelCrmGates();
      this.qualityMetrics.registerHotelCrmMetrics();
      this.logger.log('✅ Data Quality Framework initialized with HOTELCRM rules');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Data Quality Framework:', error);
    }
  }

  private async initializeDefaultPipelines(): Promise<void> {
    const defaultPipelines: EtlPipelineConfig[] = [
      {
        pipelineId: 'bookings-etl',
        sourceType: 'database',
        destinationTable: 'bookings',
        batchSize: 1000,
        watermarkDelayMinutes: 15,
        deduplicationWindowMinutes: 60,
        maxRetries: 3,
        retryDelayMs: 5000,
        enableStreaming: true,
        enableBatch: true,
      },
      {
        pipelineId: 'clients-etl',
        sourceType: 'api',
        destinationTable: 'clients',
        batchSize: 500,
        watermarkDelayMinutes: 10,
        deduplicationWindowMinutes: 30,
        maxRetries: 3,
        retryDelayMs: 3000,
        enableStreaming: true,
        enableBatch: true,
      },
      {
        pipelineId: 'payments-etl',
        sourceType: 'stream',
        destinationTable: 'payments',
        batchSize: 200,
        watermarkDelayMinutes: 5,
        deduplicationWindowMinutes: 15,
        maxRetries: 5,
        retryDelayMs: 2000,
        enableStreaming: true,
        enableBatch: false,
      },
    ];

    for (const pipeline of defaultPipelines) {
      await this.registerPipeline(pipeline);
    }

    this.logger.log(`✅ Initialized ${defaultPipelines.length} default ETL pipelines`);
  }

  async registerPipeline(config: EtlPipelineConfig): Promise<void> {
    try {
      this.validatePipelineConfig(config);
      await this.watermarking.initializeWatermark(config.pipelineId, new Date());
      this.processingQueues.set(config.pipelineId, []);
      this.activePipelines.set(config.pipelineId, config);
      this.logger.log(`✅ Registered ETL pipeline: ${config.pipelineId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to register pipeline ${config.pipelineId}:`, error);
      throw error;
    }
  }

  async startPipeline(pipelineId: string): Promise<string> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const jobId = `job-${pipelineId}-${Date.now()}`;
    const job: EtlJob = {
      id: jobId,
      pipelineId,
      status: 'running',
      startTime: new Date(),
      recordsProcessed: 0,
      recordsFailed: 0,
      watermark: await this.watermarking.getWatermark(pipelineId),
      retryCount: 0,
    };

    // Persist job
    await this.etlRepository.saveJob(job);
    this.activeJobs.set(jobId, job);
    
    this.logger.log(`🚀 Started ETL job: ${jobId} for pipeline: ${pipelineId}`);

    try {
      if (pipeline.enableStreaming) {
        await this.startStreamingProcessing(jobId, pipeline);
      }

      if (pipeline.enableBatch) {
        await this.startBatchProcessing(jobId, pipeline);
      }
    } catch (error) {
      await this.failJob(jobId, error as Error);
    }

    return jobId;
  }

  async processRecord(pipelineId: string, record: EtlRecord): Promise<void> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    try {
      const queue = this.processingQueues.get(pipelineId) || [];
      queue.push(record);
      this.processingQueues.set(pipelineId, queue);

      if (queue.length >= pipeline.batchSize || this.shouldProcessImmediately(record)) {
        await this.processBatch(pipelineId);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to process record for pipeline ${pipelineId}:`, error);
      throw error;
    }
  }

  private async processBatch(pipelineId: string): Promise<void> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) return;

    const queue = this.processingQueues.get(pipelineId) || [];
    if (queue.length === 0) return;

    this.logger.log(`🔄 Processing batch of ${queue.length} records for pipeline: ${pipelineId}`);

    try {
      const qualityChecks: QualityGateResult[] = [];
      const validRecords: EtlRecord[] = [];

      for (const record of queue) {
        try {
          const gateId = this.getGateForPipeline(pipelineId);
          const data = record.data as Record<string, unknown>;
          const recordAgencyId = (data.agency_id as string) || (data.agencyId as string) || 'default-system-agency';

          const qualityResult = await this.dataQualityGate.validateRecord(
            recordAgencyId,
            gateId,
            data,
            record.id,
            { pipelineId, source: record.source },
          );

          qualityChecks.push(qualityResult);
          if (qualityResult.passed) {
            validRecords.push(record);
          }
        } catch (error) {
          this.logger.warn(`⚠️ Quality gate rejected record ${record.id}:`, error);
        }
      }

      this.qualityMetrics.updateMetricsFromGateResults(qualityChecks);

      if (validRecords.length === 0) {
        this.processingQueues.set(pipelineId, []);
        return;
      }

      const sortedRecords = await this.eventTimeProcessor.sortByEventTime(validRecords);
      const watermarkedRecords = await this.watermarking.applyWatermark(
        pipelineId,
        sortedRecords,
        pipeline.watermarkDelayMinutes,
      );

      const deduplicatedRecords = await this.deduplication.deduplicate(
        watermarkedRecords,
        pipeline.deduplicationWindowMinutes,
      );

      if (pipeline.enableStreaming && deduplicatedRecords.length > 0) {
        await this.streamingProcessor.processRecords(pipelineId, deduplicatedRecords);
      }

      if (pipeline.enableBatch && deduplicatedRecords.length > 0) {
        await this.batchProcessor.processBatch(
          pipelineId,
          deduplicatedRecords,
          pipeline.destinationTable,
        );
      }

      if (deduplicatedRecords.length > 0) {
        const latestEventTime = Math.max(...deduplicatedRecords.map((r) => r.eventTime.getTime()));
        await this.watermarking.updateWatermark(pipelineId, new Date(latestEventTime));
      }

      this.processingQueues.set(pipelineId, []);
      this.logger.log(`✅ Successfully processed ${deduplicatedRecords.length} records for pipeline: ${pipelineId}`);
    } catch (error) {
      this.logger.error(`❌ Batch processing failed for pipeline ${pipelineId}:`, error);
      const job = Array.from(this.activeJobs.values()).find((j) => j.pipelineId === pipelineId);
      if (job && job.retryCount < pipeline.maxRetries) {
        await this.retryJob(job.id, pipeline);
      } else {
        throw error;
      }
    }
  }

  private async startStreamingProcessing(jobId: string, pipeline: EtlPipelineConfig): Promise<void> {
    try {
      await this.streamingProcessor.startStreaming(pipeline.pipelineId, {
        batchSize: pipeline.batchSize,
        watermarkDelay: pipeline.watermarkDelayMinutes,
        onRecordProcessed: () => this.updateJobProgress(jobId, 1, 0),
        onError: (error) => this.handleStreamingError(jobId, error),
      });
    } catch (error) {
      throw error;
    }
  }

  private async startBatchProcessing(jobId: string, pipeline: EtlPipelineConfig): Promise<void> {
    try {
      await this.batchProcessor.scheduleBatchJob(pipeline.pipelineId, {
        cronExpression: '0 */1 * * *',
        batchSize: pipeline.batchSize,
        onBatchComplete: (processed, failed) => this.updateJobProgress(jobId, processed, failed),
        onError: (error) => this.handleBatchError(jobId, error),
      });
    } catch (error) {
      throw error;
    }
  }

  private async handleStreamingError(jobId: string, error: Error): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    job.recordsFailed++;
    if (job.recordsFailed > 10) {
      await this.failJob(jobId, new Error('Too many streaming errors'));
    }
  }

  private async handleBatchError(jobId: string, error: Error): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    const pipeline = this.activePipelines.get(job.pipelineId);
    if (pipeline && job.retryCount < pipeline.maxRetries) {
      await this.retryJob(jobId, pipeline);
    } else {
      await this.failJob(jobId, error);
    }
  }

  private async retryJob(jobId: string, pipeline: EtlPipelineConfig): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    job.retryCount++;
    job.status = 'retrying';
    await this.etlRepository.updateJobStatus(jobId, 'retrying');
    
    const delay = pipeline.retryDelayMs * Math.pow(2, job.retryCount - 1);
    setTimeout(async () => {
      try {
        job.status = 'running';
        await this.startPipeline(pipeline.pipelineId);
      } catch (error) {
        await this.failJob(jobId, error as Error);
      }
    }, delay);
  }

  private async updateJobProgress(jobId: string, processed: number, failed: number): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    job.recordsProcessed += processed;
    job.recordsFailed += failed;
    // Debounce database update in production
    await this.etlRepository.saveJob(job);
  }

  private async failJob(jobId: string, error: Error): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.endTime = new Date();
    job.error = error.message;
    await this.etlRepository.updateJobStatus(jobId, 'failed', error.message);
  }

  private shouldProcessImmediately(record: EtlRecord): boolean {
    const age = Date.now() - record.eventTime.getTime();
    return age < 60000;
  }

  private validatePipelineConfig(config: EtlPipelineConfig): void {
    if (!config.pipelineId || !config.destinationTable) throw new Error('Invalid config');
  }

  private startBackgroundProcessing(): void {
    setInterval(async () => {
      for (const pipelineId of this.activePipelines.keys()) {
        try { await this.processBatch(pipelineId); } catch (e) {}
      }
    }, 30000);
  }

  private getGateForPipeline(pipelineId: string): string {
    const mapping: Record<string, string> = {
      'bookings-etl': 'bookings-gate',
      'clients-etl': 'clients-gate',
      'payments-etl': 'payments-gate',
    };
    return mapping[pipelineId] || 'general-gate';
  }
}