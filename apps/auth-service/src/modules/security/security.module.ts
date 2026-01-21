import { Module } from '@nestjs/common';

import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { PiiService } from './pii.service';

@Module({
  imports: [SupabaseModule],
  controllers: [SecurityController],
  providers: [SecurityService, PiiService],
  exports: [SecurityService, PiiService],
})
export class SecurityModule {}
