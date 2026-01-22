import { Injectable, Logger } from '@nestjs/common';
import { EtlRecord } from '@hotel-crm/shared';
import { EtlRepositoryPort } from './domain/ports/etl-repository.port';

@Injectable()
export class BatchProcessorService {
  private readonly logger = new Logger(BatchProcessorService.name);
  private scheduledJobs = new Map<string, NodeJS.Timeout>();

  constructor(private readonly etlRepository: EtlRepositoryPort) {}

  /**
   * Process a batch of records to destination table
   */
  async processBatch(
    pipelineId: string,
    records: EtlRecord[],
    destinationTable: string,
  ): Promise<void> {
    if (records.length === 0) return;

    this.logger.log(
      `📦 Processing batch of ${records.length} records to table: ${destinationTable}`,
    );

    try {
      const { success, failed } = await this.etlRepository.insertBatch(
        pipelineId,
        destinationTable,
        records,
      );

      if (failed > 0) {
        this.logger.warn(`⚠️ Batch processing partially failed: ${failed} records failed`);
      }

      this.logger.log(`✅ Successfully processed ${success} records to ${destinationTable}`);
    } catch (error) {
      this.logger.error(`❌ Batch processing failed for pipeline ${pipelineId}:`, error);
      throw error;
    }
  }

  /**
   * Schedule a batch job with cron-like expression
   */
  async scheduleBatchJob(
    pipelineId: string,
    config: {
      cronExpression: string;
      batchSize: number;
      onBatchComplete: (processed: number, failed: number) => void;
      onError: (error: Error) => void;
    },
  ): Promise<void> {
    const intervalMs = this.parseCronToInterval(config.cronExpression);
    const jobId = `batch-${pipelineId}`;

    const job = setInterval(async () => {
      try {
        this.logger.log(`⏰ Batch job executed for pipeline: ${pipelineId}`);
        config.onBatchComplete(0, 0);
      } catch (error) {
        this.logger.error(`Batch job error for pipeline ${pipelineId}:`, error);
        config.onError(error as Error);
      }
    }, intervalMs);

    this.scheduledJobs.set(jobId, job);
    this.logger.log(`📅 Scheduled batch job for pipeline ${pipelineId} every ${intervalMs}ms`);
  }

  /**
   * Cancel a scheduled batch job
   */
  cancelBatchJob(pipelineId: string): void {
    const jobId = `batch-${pipelineId}`;
    const job = this.scheduledJobs.get(jobId);

    if (job) {
      clearInterval(job);
      this.scheduledJobs.delete(jobId);
      this.logger.log(`🛑 Cancelled batch job for pipeline: ${pipelineId}`);
    }
  }

  private parseCronToInterval(cronExpression: string): number {
    if (cronExpression === '0 */1 * * *') return 60 * 60 * 1000;
    if (cronExpression === '0 0 * * *') return 24 * 60 * 60 * 1000;
    if (cronExpression === '*/30 * * * *') return 30 * 60 * 1000;
    return 60 * 60 * 1000;
  }
}