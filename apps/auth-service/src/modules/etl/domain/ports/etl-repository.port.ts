import { IEtlRepository, EtlRecord, EtlJob, Option } from '@hotel-crm/shared';

export abstract class EtlRepositoryPort implements IEtlRepository {
  abstract insertBatch(
    pipelineId: string,
    table: string,
    records: EtlRecord[],
  ): Promise<{ success: number; failed: number }>;

  abstract saveJob(job: EtlJob): Promise<void>;
  abstract getJob(jobId: string): Promise<Option<EtlJob>>;
  abstract updateJobStatus(jobId: string, status: EtlJob['status'], error?: string): Promise<void>;
}
