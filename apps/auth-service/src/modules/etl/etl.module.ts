import { Module } from '@nestjs/common';
import { EtlService } from './etl.service';
import { DataIngestionService } from './data-ingestion.service';
import { EventTimeProcessorService } from './event-time-processor.service';
import { WatermarkingService } from './watermarking.service';
import { DeduplicationService } from './deduplication.service';
import { BatchProcessorService } from './batch-processor.service';
import { StreamingProcessorService } from './streaming-processor.service';

@Module({
  providers: [
    EtlService,
    DataIngestionService,
    EventTimeProcessorService,
    WatermarkingService,
    DeduplicationService,
    BatchProcessorService,
    StreamingProcessorService,
  ],
  exports: [EtlService],
})
export class EtlModule {}
