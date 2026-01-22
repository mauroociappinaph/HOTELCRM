import { Module } from '@nestjs/common';

import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

import { ContextAssemblerService } from './context-assembler.service';
import { MemoryManagerService } from './memory-manager.service';
import { ContextOptimizerService } from './context-optimizer.service';
import { MultiAgentCoordinatorService } from './multi-agent-coordinator.service';
import { MemoryRepositoryPort } from './domain/ports/memory-repository.port';
import { SupabaseMemoryRepositoryAdapter } from './infrastructure/adapters/supabase-memory-repository.adapter';

@Module({
  imports: [SupabaseModule],
  providers: [
    ContextAssemblerService,
    MemoryManagerService,
    ContextOptimizerService,
    MultiAgentCoordinatorService,
    {
      provide: MemoryRepositoryPort,
      useClass: SupabaseMemoryRepositoryAdapter,
    },
  ],
  exports: [
    ContextAssemblerService,
    MemoryManagerService,
    ContextOptimizerService,
    MultiAgentCoordinatorService,
    MemoryRepositoryPort,
  ],
})
export class ContextManagerModule {}
