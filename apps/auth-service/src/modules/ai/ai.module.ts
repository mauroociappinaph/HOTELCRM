import { Module } from '@nestjs/common';

import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { ContextManagerModule } from '../context-manager/context-manager.module';
import { SecurityModule } from '../security/security.module';

import { ChatService } from './chat.service';
import { EmbeddingsService } from './embeddings.service';
import { AiController } from './ai.controller';

@Module({
  imports: [SupabaseModule, ContextManagerModule, SecurityModule],
  controllers: [AiController],
  providers: [ChatService, EmbeddingsService],
  exports: [ChatService, EmbeddingsService],
})
export class AiModule {}
