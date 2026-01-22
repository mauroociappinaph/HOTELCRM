import { Module } from '@nestjs/common';

import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { ContextManagerModule } from '../context-manager/context-manager.module';
import { SecurityModule } from '../security/security.module';

import { ChatService } from './chat.service';
import { EmbeddingsService } from './embeddings.service';
import { AiController } from './ai.controller';
import { ChatRepositoryPort } from './domain/ports/chat-repository.port';
import { SupabaseChatRepositoryAdapter } from './infrastructure/adapters/supabase-chat-repository.adapter';

@Module({
  imports: [SupabaseModule, ContextManagerModule, SecurityModule],
  controllers: [AiController],
  providers: [
    ChatService,
    EmbeddingsService,
    {
      provide: ChatRepositoryPort,
      useClass: SupabaseChatRepositoryAdapter,
    },
  ],
  exports: [ChatService, EmbeddingsService, ChatRepositoryPort],
})
export class AiModule {}
