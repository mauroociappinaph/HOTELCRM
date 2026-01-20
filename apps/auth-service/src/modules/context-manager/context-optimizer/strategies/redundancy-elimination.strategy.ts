// Redundancy Elimination Strategy - Removes duplicate and similar content
import { BaseOptimizationStrategy, StrategyResult, OptimizationConfig } from './base-strategy';
import type { ContextChunk } from '../types';
import { calculateSemanticSimilarity } from '../utils';

export class RedundancyEliminationStrategy extends BaseOptimizationStrategy {
  constructor(config: OptimizationConfig = {}) {
    super('redundancy-elimination', config);
  }

  protected getDefaultConfig(): OptimizationConfig {
    return {
      similarityThreshold: 0.85,
      maxSimilarityPairs: 10,
      relevanceWeight: 0.7,
      redundancyWeight: 0.3
    };
  }

  protected validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.similarityThreshold < 0 || this.config.similarityThreshold > 1) {
      errors.push('similarityThreshold must be between 0 and 1');
    }

    if (this.config.maxSimilarityPairs <= 0) {
      errors.push('maxSimilarityPairs must be positive');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(chunks: ContextChunk[]): Promise<StrategyResult> {
    if (chunks.length <= 1) {
      return { chunks, chunksRemoved: 0, chunksCompressed: 0 };
    }

    // MMR-inspired algorithm: balance relevance vs diversity
    const selected: ContextChunk[] = [chunks[0]]; // Always keep highest relevance chunk
    const remaining = chunks.slice(1);

    while (remaining.length > 0 && selected.length < this.config.maxSimilarityPairs) {
      let bestIndex = 0;
      let bestScore = -1;

      for (let i = 0; i < remaining.length; i++) {
        const chunk = remaining[i];
        const relevance = chunk.relevanceScore;

        // Calculate redundancy with already selected chunks
        const redundancy = selected.length > 0
          ? Math.max(...selected.map(selectedChunk =>
              calculateSemanticSimilarity(chunk, selectedChunk)))
          : 0;

        // MMR score: balance relevance vs diversity
        const mmrScore = this.config.relevanceWeight * relevance -
                        this.config.redundancyWeight * redundancy;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      selected.push(remaining[bestIndex]);
      remaining.splice(bestIndex, 1);
    }

    return {
      chunks: selected,
      chunksRemoved: chunks.length - selected.length,
      chunksCompressed: 0,
    };
  }
}
