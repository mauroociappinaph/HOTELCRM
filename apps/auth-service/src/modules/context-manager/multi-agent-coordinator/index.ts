// Multi-Agent Coordinator Module - Main barrel file
// Clean Architecture: Public API encapsulation

// Main service
export { MultiAgentCoordinatorService } from '../multi-agent-coordinator.service';

// Types (centralized)
export type {
  Agent,
  AgentTask,
  TaskResult,
  CoordinationPlan,
  TaskAnalysis,
  CoordinationStats,
  QueryContext,
} from './types';

// Sub-modules (for advanced usage)
export { AgentRegistryService } from './agents';
export { TaskManagerService } from './tasks';

// Re-export from context-assembler for convenience
export type { QueryContext as ContextQueryContext } from '../context-assembler.service';
