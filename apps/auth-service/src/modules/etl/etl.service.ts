import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataIngestionService } from './data-ingestion.service';
import { EventTimeProcessorService } from './event-time-processor.service';
import { WatermarkingService } from './watermarking.service';
import { DeduplicationService } from './deduplication.service';
import { BatchProcessorService } from './batch-processor.service';
import { StreamingProcessorService } from './streaming-processor.service';
import { DataQualityGateService, QualityGateResult } from '../data-quality/data-quality-gate.service';
import { QualityMetricsService } from '../data-quality/quality-metrics.service';
import { BusinessRulesEngineService } from '../data-quality/business-rules-engine.service';

export interface EtlPipelineConfig {
  pipelineId: string;
  sourceType: 'database' | 'api' | 'file' | 'stream';
  destinationTable: string;
  batchSize: number;
  watermarkDelayMinutes: number;
  deduplicationWindowMinutes: number;
  maxRetries: number;
  retryDelayMs: number;
  enableStreaming: boolean;
  enableBatch: boolean;
}

export interface EtlJob {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  startTime: Date;
  endTime?: Date;
  recordsProcessed: number;
  recordsFailed: number;
  watermark: Date;
  lastEventTime?: Date;
  error?: string;
  retryCount: number;
}

export interface EtlRecord {
  id: string;
  eventTime: Date;
  processingTime: Date;
  data: Record<string, any>;
  source: string;
  partitionKey?: string;
  sequenceNumber?: number;
}

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
  ) {}

  async onModuleInit() {
    await this.initializeDataQualityFramework();
    await this.initializeDefaultPipelines();
    this.startBackgroundProcessing();
  }

  /**
   * Initialize the Data Quality Framework with HOTELCRM rules and schemas
   */
  private async initializeDataQualityFramework(): Promise<void> {
    try {
      // Register HOTELCRM schemas
      this.dataQualityGate.registerHotelCrmSchemas();

      // Register HOTELCRM business rules
      this.businessRulesEngine.registerHotelCrmRules();

      // Register HOTELCRM quality gates
      this.dataQualityGate.registerHotelCrmGates();

      // Register HOTELCRM quality metrics
      this.qualityMetrics.registerHotelCrmMetrics();

      this.logger.log('✅ Data Quality Framework initialized with HOTELCRM rules');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Data Quality Framework:', error);
      // Continue without data quality - ETL will still work but without validation
    }
  }

  /**
   * Initialize default ETL pipelines for HOTELCRM
   */
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

  /**
   * Register a new ETL pipeline
   */
  async registerPipeline(config: EtlPipelineConfig): Promise<void> {
    try {
      // Validate pipeline configuration
      this.validatePipelineConfig(config);

      // Initialize watermark for the pipeline
      await this.watermarking.initializeWatermark(config.pipelineId, new Date());

      // Initialize processing queue
      this.processingQueues.set(config.pipelineId, []);

      // Register pipeline
      this.activePipelines.set(config.pipelineId, config);

      this.logger.log(`✅ Registered ETL pipeline: ${config.pipelineId}`);

    } catch (error) {
      this.logger.error(`❌ Failed to register pipeline ${config.pipelineId}:`, error);
      throw error;
    }
  }

  /**
   * Start processing data for a pipeline
   */
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

  /**
   * Process a single record through the ETL pipeline
   */
  async processRecord(pipelineId: string, record: EtlRecord): Promise<void> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    try {
      // Add to processing queue
      const queue = this.processingQueues.get(pipelineId) || [];
      queue.push(record);
      this.processingQueues.set(pipelineId, queue);

      // Process if batch size reached or immediate processing needed
      if (queue.length >= pipeline.batchSize || this.shouldProcessImmediately(record)) {
        await this.processBatch(pipelineId);
      }

    } catch (error) {
      this.logger.error(`❌ Failed to process record for pipeline ${pipelineId}:`, error);
      throw error;
    }
  }

  /**
   * Process a batch of records for a pipeline
   */
  private async processBatch(pipelineId: string): Promise<void> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) return;

    const queue = this.processingQueues.get(pipelineId) || [];
    if (queue.length === 0) return;

    this.logger.log(`🔄 Processing batch of ${queue.length} records for pipeline: ${pipelineId}`);

    try {
      // 🔍 PASO 1: Aplicar Quality Gates (Aduanas de Data Quality)
      const qualityChecks: QualityGateResult[] = [];
      const validRecords: EtlRecord[] = [];

      for (const record of queue) {
        try {
          // Determinar qué quality gate usar basado en el pipeline
          const gateId = this.getGateForPipeline(pipelineId);

          const qualityResult = await this.dataQualityGate.validateRecord(
            gateId,
            record.data, // Validar solo los datos, no el wrapper del record
            record.id,
            { pipelineId, source: record.source }
          );

          qualityChecks.push(qualityResult);

          if (qualityResult.passed) {
            validRecords.push(record);
          }

        } catch (error) {
          this.logger.warn(`⚠️ Quality gate rejected record ${record.id}:`, error instanceof Error ? error.message : error);
          // Record is automatically quarantined by the quality gate
        }
      }

      // Update quality metrics
      this.qualityMetrics.updateMetricsFromGateResults(qualityChecks);

      this.logger.log(`🛡️ Quality gates processed: ${qualityChecks.filter(c => c.passed).length}/${qualityChecks.length} records passed`);

      if (validRecords.length === 0) {
        this.logger.log(`⚠️ No valid records to process for pipeline: ${pipelineId}`);
        this.processingQueues.set(pipelineId, []);
        return;
      }

      // 🔄 PASO 2: Sort records by event time to handle out-of-order data
      const sortedRecords = await this.eventTimeProcessor.sortByEventTime(validRecords);

      // 🌊 PASO 3: Apply watermarking for late-arriving data
      const watermarkedRecords = await this.watermarking.applyWatermark(
        pipelineId,
        sortedRecords,
        pipeline.watermarkDelayMinutes
      );

      // 🗑️ PASO 4: Deduplicate records
      const deduplicatedRecords = await this.deduplication.deduplicate(
        watermarkedRecords,
        pipeline.deduplicationWindowMinutes
      );

      // 📊 PASO 5: Process through appropriate processor
      if (pipeline.enableStreaming && deduplicatedRecords.length > 0) {
        await this.streamingProcessor.processRecords(pipelineId, deduplicatedRecords);
      }

      if (pipeline.enableBatch && deduplicatedRecords.length > 0) {
        await this.batchProcessor.processBatch(pipelineId, deduplicatedRecords, pipeline.destinationTable);
      }

      // 📈 PASO 6: Update watermark
      if (deduplicatedRecords.length > 0) {
        const latestEventTime = Math.max(...deduplicatedRecords.map(r => r.eventTime.getTime()));
        await this.watermarking.updateWatermark(pipelineId, new Date(latestEventTime));
      }

      // 🧹 PASO 7: Clear processed records from queue
      this.processingQueues.set(pipelineId, []);

      this.logger.log(`✅ Successfully processed ${deduplicatedRecords.length}/${validRecords.length} records for pipeline: ${pipelineId}`);

    } catch (error) {
      this.logger.error(`❌ Batch processing failed for pipeline ${pipelineId}:`, error);

      // Implement retry logic
      const job = Array.from(this.activeJobs.values()).find(j => j.pipelineId === pipelineId);
      if (job && job.retryCount < pipeline.maxRetries) {
        await this.retryJob(job.id, pipeline);
      } else {
        throw error;
      }
    }
  }

  /**
   * Start streaming processing for a pipeline
   */
  private async startStreamingProcessing(jobId: string, pipeline: EtlPipelineConfig): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      await this.streamingProcessor.startStreaming(pipeline.pipelineId, {
        batchSize: pipeline.batchSize,
        watermarkDelay: pipeline.watermarkDelayMinutes,
        onRecordProcessed: (record) => this.updateJobProgress(jobId, 1, 0),
        onError: (error) => this.handleStreamingError(jobId, error),
      });

      this.logger.log(`🌊 Streaming processing started for pipeline: ${pipeline.pipelineId}`);

    } catch (error) {
      this.logger.error(`Failed to start streaming for pipeline ${pipeline.pipelineId}:`, error);
      throw error;
    }
  }

  /**
   * Start batch processing for a pipeline
   */
  private async startBatchProcessing(jobId: string, pipeline: EtlPipelineConfig): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      await this.batchProcessor.scheduleBatchJob(pipeline.pipelineId, {
        cronExpression: '0 */1 * * *', // Every hour
        batchSize: pipeline.batchSize,
        onBatchComplete: (processed, failed) => this.updateJobProgress(jobId, processed, failed),
        onError: (error) => this.handleBatchError(jobId, error),
      });

      this.logger.log(`📦 Batch processing scheduled for pipeline: ${pipeline.pipelineId}`);

    } catch (error) {
      this.logger.error(`Failed to start batch processing for pipeline ${pipeline.pipelineId}:`, error);
      throw error;
    }
  }

  /**
   * Handle streaming processing errors
   */
  private async handleStreamingError(jobId: string, error: Error): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.recordsFailed++;
    this.logger.error(`Streaming error for job ${jobId}:`, error);

    // Implement circuit breaker pattern for streaming errors
    if (job.recordsFailed > 10) {
      await this.failJob(jobId, new Error('Too many streaming errors'));
    }
  }

  /**
   * Handle batch processing errors
   */
  private async handleBatchError(jobId: string, error: Error): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    this.logger.error(`Batch error for job ${jobId}:`, error);

    // Retry batch job with exponential backoff
    const pipeline = this.activePipelines.get(job.pipelineId);
    if (pipeline && job.retryCount < pipeline.maxRetries) {
      await this.retryJob(jobId, pipeline);
    } else {
      await this.failJob(jobId, error);
    }
  }

  /**
   * Retry a failed job
   */
  private async retryJob(jobId: string, pipeline: EtlPipelineConfig): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.retryCount++;
    job.status = 'retrying';

    const delay = pipeline.retryDelayMs * Math.pow(2, job.retryCount - 1); // Exponential backoff

    setTimeout(async () => {
      try {
        job.status = 'running';
        await this.startPipeline(pipeline.pipelineId);
      } catch (error) {
        await this.failJob(jobId, error as Error);
      }
    }, delay);

    this.logger.log(`🔄 Retrying job ${jobId} (attempt ${job.retryCount}/${pipeline.maxRetries})`);
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(jobId: string, processed: number, failed: number): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.recordsProcessed += processed;
    job.recordsFailed += failed;
  }

  /**
   * Mark job as failed
   */
  private async failJob(jobId: string, error: Error): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.status = 'failed';
    job.endTime = new Date();
    job.error = error.message;

    this.logger.error(`❌ Job ${jobId} failed: ${error.message}`);
  }

  /**
   * Complete a job
   */
  private async completeJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.status = 'completed';
    job.endTime = new Date();

    this.logger.log(`✅ Job ${jobId} completed successfully`);
  }

  /**
   * Determine if a record should be processed immediately
   */
  private shouldProcessImmediately(record: EtlRecord): boolean {
    // Process immediately for high-priority records or time-sensitive data
    const age = Date.now() - record.eventTime.getTime();
    return age < 60000; // Process immediately if less than 1 minute old
  }

  /**
   * Validate pipeline configuration
   */
  private validatePipelineConfig(config: EtlPipelineConfig): void {
    if (!config.pipelineId || !config.destinationTable) {
      throw new Error('Pipeline ID and destination table are required');
    }

    if (config.batchSize <= 0 || config.batchSize > 10000) {
      throw new Error('Batch size must be between 1 and 10000');
    }

    if (config.watermarkDelayMinutes < 0 || config.watermarkDelayMinutes > 1440) {
      throw new Error('Watermark delay must be between 0 and 1440 minutes');
    }

    if (config.deduplicationWindowMinutes < 0 || config.deduplicationWindowMinutes > 1440) {
      throw new Error('Deduplication window must be between 0 and 1440 minutes');
    }
  }

  /**
   * Start background processing for all pipelines
   */
  private startBackgroundProcessing(): void {
    // Process batches every 30 seconds
    setInterval(async () => {
      for (const pipelineId of this.activePipelines.keys()) {
        try {
          await this.processBatch(pipelineId);
        } catch (error) {
          this.logger.error(`Background processing failed for pipeline ${pipelineId}:`, error);
        }
      }
    }, 30000);

    // Clean up old jobs every hour
    setInterval(async () => {
      await this.cleanupOldJobs();
    }, 3600000);

    this.logger.log('🔄 Background ETL processing started');
  }

  /**
   * Clean up old completed jobs
   */
  private async cleanupOldJobs(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.endTime && job.endTime < cutoffTime) {
        this.activeJobs.delete(jobId);
      }
    }

    this.logger.log('🧹 Cleaned up old ETL jobs');
  }

  /**
   * Get pipeline statistics
   */
  getPipelineStats(pipelineId: string) {
    const pipeline = this.activePipelines.get(pipelineId);
    const queue = this.processingQueues.get(pipelineId) || [];
    const activeJobs = Array.from(this.activeJobs.values()).filter(j => j.pipelineId === pipelineId);

    return {
      pipeline: pipeline ? { ...pipeline } : null,
      queueSize: queue.length,
      activeJobs: activeJobs.length,
      jobs: activeJobs,
      watermark: pipeline ? this.watermarking.getWatermark(pipelineId) : null,
    };
  }

  /**
   * Get all pipeline statistics
   */
  getAllPipelineStats() {
    const stats: Record<string, any> = {};
    for (const pipelineId of this.activePipelines.keys()) {
      stats[pipelineId] = this.getPipelineStats(pipelineId);
    }
    return stats;
  }

  /**
   * Get the appropriate quality gate for a pipeline
   */
  private getGateForPipeline(pipelineId: string): string {
    // Map pipeline IDs to their corresponding quality gates
    const gateMapping: Record<string, string> = {
      'bookings-etl': 'bookings-gate',
      'clients-etl': 'clients-gate',
      'payments-etl': 'payments-gate',
    };

    return gateMapping[pipelineId] || 'general-gate';
  }

  /**
   * Get data quality summary for monitoring
   */
  getDataQualitySummary() {
    return {
      qualityScore: this.qualityMetrics.calculateQualityScore(),
      qualityGates: this.dataQualityGate.getQualityGateSummary(),
    };
  }
}
