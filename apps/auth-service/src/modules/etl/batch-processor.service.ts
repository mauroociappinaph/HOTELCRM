import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

@Injectable()
export class BatchProcessorService {
  private readonly logger = new Logger(BatchProcessorService.name);
  private scheduledJobs = new Map<string, NodeJS.Timeout>();

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Process a batch of records to destination table
   */
  async processBatch(pipelineId: string, records: any[], destinationTable: string): Promise<void> {
    if (records.length === 0) return;

    this.logger.log(`📦 Processing batch of ${records.length} records to table: ${destinationTable}`);

    try {
      const client = this.supabaseService.getClient();

      // Transform records for insertion
      const transformedRecords = records.map(record => ({
        ...record.data,
        event_time: record.eventTime.toISOString(),
        processing_time: record.processingTime.toISOString(),
        pipeline_id: pipelineId,
        source: record.source,
        partition_key: record.partitionKey,
        sequence_number: record.sequenceNumber,
      }));

      // Insert in batches to avoid payload size limits
      const batchSize = 100;
      for (let i = 0; i < transformedRecords.length; i += batchSize) {
        const batch = transformedRecords.slice(i, i + batchSize);
        const { error } = await client.from(destinationTable).insert(batch);

        if (error) {
          this.logger.error(`Batch insert error for ${destinationTable}:`, error);
          throw error;
        }
      }

      this.logger.log(`✅ Successfully processed ${records.length} records to ${destinationTable}`);

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
    }
  ): Promise<void> {
    // For simplicity, we'll use setInterval with basic scheduling
    // In production, you'd use a proper job scheduler like node-cron

    const intervalMs = this.parseCronToInterval(config.cronExpression);
    const jobId = `batch-${pipelineId}`;

    const job = setInterval(async () => {
      try {
        // In a real implementation, you'd fetch pending records here
        // For now, just log that the job ran
        this.logger.log(`⏰ Batch job executed for pipeline: ${pipelineId}`);

        // Call completion callback
        config.onBatchComplete(0, 0); // processed, failed

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

  /**
   * Parse simple cron expression to interval (basic implementation)
   */
  private parseCronToInterval(cronExpression: string): number {
    // Very basic cron parser - in production use a proper library
    if (cronExpression === '0 */1 * * *') {
      return 60 * 60 * 1000; // Every hour
    }
    if (cronExpression === '0 0 * * *') {
      return 24 * 60 * 60 * 1000; // Every day
    }
    if (cronExpression === '*/30 * * * *') {
      return 30 * 60 * 1000; // Every 30 minutes
    }

    // Default to 1 hour
    return 60 * 60 * 1000;
  }
}
