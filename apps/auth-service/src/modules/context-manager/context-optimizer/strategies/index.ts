// Context Optimizer Strategies - Barrel file for clean imports
export { BaseOptimizationStrategy } from './base-strategy';
export type { StrategyResult, OptimizationConfig } from './base-strategy';

export { RedundancyEliminationStrategy } from './redundancy-elimination.strategy';

// Future strategies to be added:
// export { TemporalFilteringStrategy } from './temporal-filtering.strategy';
// export { RelevanceBoostingStrategy } from './relevance-boosting.strategy';
// export { ContentCompressionStrategy } from './content-compression.strategy';
// export { SemanticDeduplicationStrategy } from './semantic-deduplication.strategy';
