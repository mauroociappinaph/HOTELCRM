/**
 * ETL Module Interfaces
 * Strictly typed definitions for data processing pipelines
 */

export interface EtlRecord<T = Record<string, any>> {
  id: string;
  eventTime: Date;
  processingTime: Date;
  data: T;
  source: string;
  partitionKey?: string;
  sequenceNumber?: number;
}

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
