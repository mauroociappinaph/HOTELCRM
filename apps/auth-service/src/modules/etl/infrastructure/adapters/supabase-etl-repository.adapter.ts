import { Injectable, Logger } from '@nestjs/common';
import { EtlRecord, EtlJob, Option } from '@hotel-crm/shared';

import { EtlRepositoryPort } from '../../domain/ports/etl-repository.port';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';

@Injectable()
export class SupabaseEtlRepositoryAdapter implements EtlRepositoryPort {
  private readonly logger = new Logger(SupabaseEtlRepositoryAdapter.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async insertBatch(
    pipelineId: string,
    table: string,
    records: EtlRecord[],
  ): Promise<{ success: number; failed: number }> {
    const client = this.supabaseService.getClient();

    const transformedRecords = records.map((record) => ({
      ...(record.data as Record<string, unknown>),
      event_time: record.eventTime.toISOString(),
      processing_time: record.processingTime.toISOString(),
      pipeline_id: pipelineId,
      source: record.source,
      partition_key: record.partitionKey,
      sequence_number: record.sequenceNumber,
    }));

    let successCount = 0;
    let failedCount = 0;

    // Insert in batches of 100 to avoid payload size limits
    const batchSize = 100;
    for (let i = 0; i < transformedRecords.length; i += batchSize) {
      const batch = transformedRecords.slice(i, i + batchSize);
      const { error } = await client.from(table).insert(batch);

      if (error) {
        this.logger.error(`Batch insert error for table ${table}:`, error);
        failedCount += batch.length;
      } else {
        successCount += batch.length;
      }
    }

    return { success: successCount, failed: failedCount };
  }

  async saveJob(job: EtlJob): Promise<void> {
    const client = this.supabaseService.getClient();
    const dbJob = {
      id: job.id,
      pipeline_id: job.pipelineId,
      status: job.status,
      start_time: job.startTime.toISOString(),
      end_time: job.endTime?.toISOString(),
      records_processed: job.recordsProcessed,
      records_failed: job.recordsFailed,
      watermark: job.watermark.toISOString(),
      last_event_time: job.lastEventTime?.toISOString(),
      error: job.error,
      retry_count: job.retryCount,
    };

    const { error } = await client.from('etl_jobs').upsert(dbJob);
    if (error) throw error;
  }

  async getJob(jobId: string): Promise<Option<EtlJob>> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.from('etl_jobs').select('*').eq('id', jobId).single();

    if (error) {
      if (error.code === 'PGRST116') return { some: false, value: undefined };
      throw error;
    }

    return {
      some: true,
      value: this.mapJobFromDb(data),
    };
  }

  async updateJobStatus(jobId: string, status: EtlJob['status'], error?: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const updateData: any = { status };
    if (error) updateData.error = error;
    if (status === 'completed' || status === 'failed') {
      updateData.end_time = new Date().toISOString();
    }

    const { error: dbError } = await client.from('etl_jobs').update(updateData).eq('id', jobId);

    if (dbError) throw dbError;
  }

  private mapJobFromDb(db: any): EtlJob {
    return {
      id: db.id,
      pipelineId: db.pipeline_id,
      status: db.status,
      startTime: new Date(db.start_time),
      endTime: db.end_time ? new Date(db.end_time) : undefined,
      recordsProcessed: db.records_processed,
      recordsFailed: db.records_failed,
      watermark: new Date(db.watermark),
      lastEventTime: db.last_event_time ? new Date(db.last_event_time) : undefined,
      error: db.error,
      retryCount: db.retry_count,
    };
  }
}
