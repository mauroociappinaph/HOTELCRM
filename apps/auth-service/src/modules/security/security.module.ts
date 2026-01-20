import { Module } from '@nestjs/common';

import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [SupabaseModule],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
