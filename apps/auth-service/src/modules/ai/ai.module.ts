import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { EmbeddingsService } from './embeddings.service';
import { AiController } from './ai.controller';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AiController],
  providers: [ChatService, EmbeddingsService],
  exports: [ChatService, EmbeddingsService],
})
export class AiModule {}
