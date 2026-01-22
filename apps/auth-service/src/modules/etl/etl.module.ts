import { Module } from '@nestjs/common';

import { DataQualityModule } from '../data-quality/data-quality.module';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

import { EtlService } from './etl.service';
import { DataIngestionService } from './data-ingestion.service';
import { EventTimeProcessorService } from './event-time-processor.service';
import { WatermarkingService } from './watermarking.service';
import { DeduplicationService } from './deduplication.service';
import { BatchProcessorService } from './batch-processor.service';
import { StreamingProcessorService } from './streaming-processor.service';
import { EtlRepositoryPort } from './domain/ports/etl-repository.port';
import { SupabaseEtlRepositoryAdapter } from './infrastructure/adapters/supabase-etl-repository.adapter';

@Module({
  imports: [DataQualityModule, SupabaseModule],
  providers: [
    EtlService,
    DataIngestionService,
    EventTimeProcessorService,
    WatermarkingService,
    DeduplicationService,
    BatchProcessorService,
    StreamingProcessorService,
    {
      provide: EtlRepositoryPort,
      useClass: SupabaseEtlRepositoryAdapter,
    },
  ],
  exports: [EtlService, EtlRepositoryPort],
})
export class EtlModule {}
