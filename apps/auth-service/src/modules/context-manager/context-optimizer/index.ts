// Context Optimizer Module - Main barrel file
// Clean Architecture: Public API encapsulation

// Main service
export { ContextOptimizerService } from '../context-optimizer.service';

// Types (centralized)
export type {
  OptimizationStrategy,
  OptimizationResult,
  ContextCompressionResult,
  ContextChunk,
  OptimizedContext,
} from './types';

// Utils (pure functions, SRP compliant)
export {
  calculateSemanticSimilarity,
  calculateTemporalScore,
  extractMainConcept,
  truncateContent,
  calculateOverallRelevance,
  estimateCompressionQuality,
  mergeStrategies,
  validateOptimizationConfig,
} from './utils';

// Strategies (Strategy Pattern implementation)
export {
  BaseOptimizationStrategy,
  RedundancyEliminationStrategy,
} from './strategies';

export type {
  StrategyResult,
  OptimizationConfig,
} from './strategies';

// Future exports:
// export { TemporalFilteringStrategy } from './strategies';
// export { RelevanceBoostingStrategy } from './strategies';
// export { ContentCompressionStrategy } from './strategies';
// export { SemanticDeduplicationStrategy } from './strategies';
