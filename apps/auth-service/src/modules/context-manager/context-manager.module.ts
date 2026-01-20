import { Module } from '@nestjs/common';
import { ContextAssemblerService } from './context-assembler.service';
import { MemoryManagerService } from './memory-manager.service';
import { ContextOptimizerService } from './context-optimizer.service';
import { MultiAgentCoordinatorService } from './multi-agent-coordinator.service';
import { ContextMetricsService } from './context-metrics.service';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [
    ContextAssemblerService,
    MemoryManagerService,
    ContextOptimizerService,
    MultiAgentCoordinatorService,
    ContextMetricsService,
  ],
  exports: [
    ContextAssemblerService,
    MemoryManagerService,
    ContextOptimizerService,
    MultiAgentCoordinatorService,
    ContextMetricsService,
  ],
})
export class ContextManagerModule {}
