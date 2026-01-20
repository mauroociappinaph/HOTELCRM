// Context Optimizer Service - Main orchestrator (refactored for modularity)
import { Injectable, Logger } from '@nestjs/common';
import { OptimizedContext } from './context-assembler.service';

// Modular imports following Clean Architecture
import type {
  ContextChunk,
  OptimizationStrategy,
  OptimizationResult,
  ContextCompressionResult
} from './context-optimizer/types';

import {
  calculateOverallRelevance,
  mergeStrategies,
  validateOptimizationConfig
} from './context-optimizer/utils';

import {
  RedundancyEliminationStrategy
} from './context-optimizer/strategies';

@Injectable()
export class ContextOptimizerService {
  private readonly logger = new Logger(ContextOptimizerService.name);

  // Default strategies with proper configuration
  private readonly defaultStrategies: OptimizationStrategy[] = [
    {
      name: 'redundancy-elimination',
      description: 'Remove duplicate and highly similar content using MMR',
      priority: 1,
      isEnabled: true,
      config: {
        similarityThreshold: 0.85,
        maxSimilarityPairs: 10,
        relevanceWeight: 0.7,
        redundancyWeight: 0.3,
      },
    },
    // Future strategies will be added here
  ];

  /**
   * Main optimization method - now clean and focused
   * Orchestrates multiple strategies following Strategy Pattern
   */
  async optimizeContext(
    chunks: ContextChunk[],
    targetTokens: number,
    strategies: Partial<OptimizationStrategy>[] = []
  ): Promise<OptimizedContext> {
    const startTime = Date.now();
    const originalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    // Validate input
    const validation = validateOptimizationConfig({ targetTokens, strategies });
    if (!validation.valid) {
      throw new Error(`Invalid optimization config: ${validation.errors.join(', ')}`);
    }

    // Merge strategies using pure function
    const activeStrategies = mergeStrategies(strategies);

    let optimizedChunks = [...chunks];
    const appliedStrategies: string[] = [];
    let totalChunksRemoved = 0;
    let totalChunksCompressed = 0;

    // Execute strategies using Strategy Pattern
    for (const strategy of activeStrategies.filter(s => s.isEnabled)) {
      try {
        const result = await this.executeStrategy(strategy, optimizedChunks, targetTokens);
        optimizedChunks = result.chunks;
        appliedStrategies.push(strategy.name);

        totalChunksRemoved += result.chunksRemoved;
        totalChunksCompressed += result.chunksCompressed;

        this.logger.debug(`Applied ${strategy.name}: removed ${result.chunksRemoved}, compressed ${result.chunksCompressed}`);
      } catch (error) {
        this.logger.warn(`Strategy ${strategy.name} failed:`, error);
        // Continue with other strategies
      }
    }

    // Final optimization and metrics
    const finalTokens = optimizedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const compressionRatio = originalTokens > 0 ? finalTokens / originalTokens : 1;

    return {
      chunks: optimizedChunks,
      totalTokens: finalTokens,
      compressionRatio,
      relevanceScore: calculateOverallRelevance(optimizedChunks),
      assemblyStrategy: 'optimized-context',
      metadata: {
        assemblyTime: Date.now() - startTime,
        strategiesUsed: appliedStrategies,
        pruningStats: {
          originalChunks: chunks.length,
          prunedChunks: chunks.length - optimizedChunks.length,
          redundancyRemoved: totalChunksRemoved,
        },
      },
    };
  }

  /**
   * Execute a specific optimization strategy using Strategy Pattern
   * Clean separation of concerns - service focuses on orchestration
   */
  private async executeStrategy(
    strategy: OptimizationStrategy,
    chunks: ContextChunk[],
    targetTokens: number
  ): Promise<{
    chunks: ContextChunk[];
    chunksRemoved: number;
    chunksCompressed: number;
  }> {
    // Map strategy names to concrete implementations
    const strategyMap: Record<string, any> = {
      'redundancy-elimination': RedundancyEliminationStrategy,
      // Future strategies will be added here
    };

    const StrategyClass = strategyMap[strategy.name];
    if (!StrategyClass) {
      this.logger.warn(`Unknown strategy: ${strategy.name}`);
      return { chunks, chunksRemoved: 0, chunksCompressed: 0 };
    }

    // Create and execute strategy
    const strategyInstance = new StrategyClass(strategy.config);
    return await strategyInstance.execute(chunks);
  }

  /**
   * Legacy method for backward compatibility
   * Delegates to the main optimization method
   */
  async compressContext(
    chunks: ContextChunk[],
    targetTokens: number
  ): Promise<ContextCompressionResult> {
    const result = await this.optimizeContext(chunks, targetTokens);

    return {
      compressed: result.totalTokens < chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      originalContent: chunks.map(c => c.content).join(' '),
      compressedContent: result.chunks.map(c => c.content).join(' '),
      originalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      compressedTokens: result.totalTokens,
      compressionRatio: result.compressionRatio,
      qualityPreserved: result.relevanceScore,
    };
  }
}
