import { Module } from '@nestjs/common';
import { SchemaValidatorService } from './schema-validator.service';
import { BusinessRulesEngineService } from './business-rules-engine.service';
import { DataQualityGateService } from './data-quality-gate.service';
import { QuarantineService } from './quarantine.service';
import { QualityMetricsService } from './quality-metrics.service';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [
    SchemaValidatorService,
    BusinessRulesEngineService,
    DataQualityGateService,
    QuarantineService,
    QualityMetricsService,
  ],
  exports: [
    SchemaValidatorService,
    BusinessRulesEngineService,
    DataQualityGateService,
    QuarantineService,
    QualityMetricsService,
  ],
})
export class DataQualityModule {}
