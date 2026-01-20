import { Module } from '@nestjs/common';
import { ContextAssemblerService } from './context-assembler.service';
import { MemoryManagerService } from './memory-manager.service';
import { ContextOptimizerService } from './context-optimizer.service';
import { MultiAgentCoordinatorService } from './multi-agent-coordinator.service';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [
    ContextAssemblerService,
    MemoryManagerService,
    ContextOptimizerService,
    MultiAgentCoordinatorService,
  ],
  exports: [
    ContextAssemblerService,
    MemoryManagerService,
    ContextOptimizerService,
    MultiAgentCoordinatorService,
  ],
})
export class ContextManagerModule {}
