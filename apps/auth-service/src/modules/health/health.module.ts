import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { SupabaseModule } from '../../../infrastructure/supabase/supabase.module';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [TerminusModule, SupabaseModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}