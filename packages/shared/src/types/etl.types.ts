/**
 * ETL and Data Engineering Types for HOTELCRM
 */

export interface EtlRecord<T = Record<string, unknown>> {
  id: string;
  eventTime: Date;
  processingTime: Date;
  data: T;
  source: string;
  partitionKey?: string;
  sequenceNumber?: number;
}

export interface IngestionFilters {
  startDate?: Date;
  endDate?: Date;
  categories?: string[];
  status?: string[];
  [key: string]: unknown;
}

export interface DataSourceMetadata {
  totalRecords?: number;
  lastUpdated?: Date;
  schemaVersion?: string;
  encoding?: string;
  provider?: string;
  [key: string]: unknown;
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

export interface PipelineStats {
  throughput: number;
  latencyMs: number;
  errorRate: number;
  activeStreams: number;
  [key: string]: unknown;
}

export interface QualityGateResult {
  gateId: string;
  recordId: string;
  passed: boolean;
  rejectedReason?: string;
  quarantined: boolean;
  checks: DataQualityCheck;
  processingTime: number;
}

export interface DataQualityCheck {
  schemaValidation?: unknown;
  businessRulesValidation?: unknown;
  overallResult: boolean;
  rejectedReason?: string;
  checkTime: number;
}
