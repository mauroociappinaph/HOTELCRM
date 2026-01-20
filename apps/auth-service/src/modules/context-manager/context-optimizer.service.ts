import { Injectable, Logger } from '@nestjs/common';

import { ContextChunk, OptimizedContext } from './context-assembler.service';

export interface OptimizationStrategy {
  name: string;
  description: string;
  priority: number;
  isEnabled: boolean;
  config: Record<string, any>;
}

export interface OptimizationResult {
  originalTokens: number;
  optimizedTokens: number;
  compressionRatio: number;
  strategiesApplied: string[];
  chunksRemoved: number;
  chunksCompressed: number;
  qualityImpact: number; // -1 to 1, negative = quality loss, positive = quality gain
}

export interface ContextCompressionResult {
  compressed: boolean;
  originalContent: string;
  compressedContent: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  qualityPreserved: number; // 0-1
}

@Injectable()
export class ContextOptimizerService {
  private readonly logger = new Logger(ContextOptimizerService.name);

  private readonly defaultStrategies: OptimizationStrategy[] = [
    {
      name: 'redundancy-elimination',
      description: 'Remove duplicate and highly similar content using MMR',
      priority: 1,
      isEnabled: true,
      config: {
        similarityThreshold: 0.85,
        maxSimilarityPairs: 10,
      },
    },
    {
      name: 'temporal-filtering',
      description: 'Prioritize recent content over older information',
      priority: 2,
      isEnabled: true,
      config: {
        recencyWeight: 0.3,
        ageDecayFactor: 0.8,
      },
    },
    {
      name: 'relevance-boosting',
      description: 'Amplify highly relevant chunks, reduce irrelevant ones',
      priority: 3,
      isEnabled: true,
      config: {
        relevanceThreshold: 0.7,
        boostFactor: 1.5,
        dampenFactor: 0.5,
      },
    },
    {
      name: 'content-compression',
      description: 'Compress verbose content while preserving meaning',
      priority: 4,
      isEnabled: true,
      config: {
        maxCompressionRatio: 0.6,
        preserveKeyPhrases: true,
      },
    },
    {
      name: 'semantic-deduplication',
      description: 'Remove semantically duplicate information',
      priority: 5,
      isEnabled: true,
      config: {
        semanticSimilarityThreshold: 0.9,
        conceptClustering: true,
      },
    },
  ];

  /**
   * Optimize context using multiple strategies
   */
  async optimizeContext(
    chunks: ContextChunk[],
    targetTokens: number,
    strategies: Partial<OptimizationStrategy>[] = [],
  ): Promise<OptimizedContext> {
    const startTime = Date.now();
    const originalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    // Merge custom strategies with defaults
    const activeStrategies = this.mergeStrategies(strategies);

    let optimizedChunks = [...chunks];
    const appliedStrategies: string[] = [];
    let totalChunksRemoved = 0;
    let totalChunksCompressed = 0;

    // Apply strategies in priority order
    for (const strategy of activeStrategies.filter((s) => s.isEnabled)) {
      try {
        const result = await this.applyStrategy(strategy, optimizedChunks, targetTokens);
        optimizedChunks = result.chunks;
        appliedStrategies.push(strategy.name);

        if (result.chunksRemoved > 0 || result.chunksCompressed > 0) {
          totalChunksRemoved += result.chunksRemoved;
          totalChunksCompressed += result.chunksCompressed;
        }

        this.logger.debug(
          `Applied ${strategy.name}: removed ${result.chunksRemoved}, compressed ${result.chunksCompressed}`,
        );
      } catch (error) {
        this.logger.warn(`Strategy ${strategy.name} failed:`, error);
        // Continue with other strategies
      }
    }

    // Final token count check and trimming
    const finalTokens = optimizedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    if (finalTokens > targetTokens) {
      optimizedChunks = await this.trimToTokenLimit(optimizedChunks, targetTokens);
    }

    const finalTokensCount = optimizedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const compressionRatio = originalTokens > 0 ? finalTokensCount / originalTokens : 1;

    return {
      chunks: optimizedChunks,
      totalTokens: finalTokensCount,
      compressionRatio,
      relevanceScore: this.calculateOverallRelevance(optimizedChunks),
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
   * Apply a specific optimization strategy
   */
  private async applyStrategy(
    strategy: OptimizationStrategy,
    chunks: ContextChunk[],
    targetTokens: number,
  ): Promise<{
    chunks: ContextChunk[];
    chunksRemoved: number;
    chunksCompressed: number;
  }> {
    switch (strategy.name) {
      case 'redundancy-elimination':
        return this.applyRedundancyElimination(chunks, strategy.config);

      case 'temporal-filtering':
        return this.applyTemporalFiltering(chunks, strategy.config);

      case 'relevance-boosting':
        return this.applyRelevanceBoosting(chunks, strategy.config);

      case 'content-compression':
        return this.applyContentCompression(chunks, strategy.config, targetTokens);

      case 'semantic-deduplication':
        return this.applySemanticDeduplication(chunks, strategy.config);

      default:
        return { chunks, chunksRemoved: 0, chunksCompressed: 0 };
    }
  }

  /**
   * Remove redundant content using Maximal Marginal Relevance
   */
  private async applyRedundancyElimination(
    chunks: ContextChunk[],
    config: any,
  ): Promise<{
    chunks: ContextChunk[];
    chunksRemoved: number;
    chunksCompressed: number;
  }> {
    if (chunks.length <= 1) return { chunks, chunksRemoved: 0, chunksCompressed: 0 };

    const selected: ContextChunk[] = [chunks[0]]; // Always keep the highest relevance chunk
    const remaining = chunks.slice(1);

    while (remaining.length > 0 && selected.length < config.maxSimilarityPairs) {
      let bestIndex = 0;
      let bestScore = -1;

      for (let i = 0; i < remaining.length; i++) {
        const chunk = remaining[i];
        const relevance = chunk.relevanceScore;

        // Calculate redundancy with already selected chunks
        const redundancy =
          selected.length > 0
            ? Math.max(
                ...selected.map((selectedChunk) =>
                  this.calculateSemanticSimilarity(chunk, selectedChunk),
                ),
              )
            : 0;

        // MMR score: balance relevance vs diversity
        const mmrScore = config.relevanceWeight * relevance - config.redundancyWeight * redundancy;

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

  /**
   * Apply temporal filtering to prioritize recent content
   */
  private async applyTemporalFiltering(
    chunks: ContextChunk[],
    config: any,
  ): Promise<{
    chunks: ContextChunk[];
    chunksRemoved: number;
    chunksCompressed: number;
  }> {
    const now = Date.now();
    const filteredChunks = chunks.map((chunk) => ({
      ...chunk,
      temporalScore: this.calculateTemporalScore(chunk.timestamp, now, config),
      combinedScore:
        chunk.relevanceScore * (1 - config.recencyWeight) +
        this.calculateTemporalScore(chunk.timestamp, now, config) * config.recencyWeight,
    }));

    // Sort by combined score and keep top chunks
    filteredChunks.sort((a, b) => b.combinedScore - a.combinedScore);
    const selectedChunks = filteredChunks.slice(0, Math.ceil(chunks.length * 0.8)); // Keep 80%

    return {
      chunks: selectedChunks.map(({ temporalScore, combinedScore, ...chunk }) => chunk),
      chunksRemoved: chunks.length - selectedChunks.length,
      chunksCompressed: 0,
    };
  }

  /**
   * Boost highly relevant chunks and dampen irrelevant ones
   */
  private async applyRelevanceBoosting(
    chunks: ContextChunk[],
    config: any,
  ): Promise<{
    chunks: ContextChunk[];
    chunksRemoved: number;
    chunksCompressed: number;
  }> {
    const processedChunks = chunks.map((chunk) => {
      let adjustedScore = chunk.relevanceScore;

      if (chunk.relevanceScore >= config.relevanceThreshold) {
        // Boost highly relevant chunks
        adjustedScore = Math.min(1.0, chunk.relevanceScore * config.boostFactor);
      } else if (chunk.relevanceScore < config.relevanceThreshold * 0.5) {
        // Dampen irrelevant chunks
        adjustedScore = chunk.relevanceScore * config.dampenFactor;
      }

      return {
        ...chunk,
        relevanceScore: adjustedScore,
      };
    });

    // Remove chunks with very low adjusted relevance
    const filteredChunks = processedChunks.filter((chunk) => chunk.relevanceScore >= 0.3);

    return {
      chunks: filteredChunks,
      chunksRemoved: chunks.length - filteredChunks.length,
      chunksCompressed: 0,
    };
  }

  /**
   * Compress content while preserving meaning
   */
  private async applyContentCompression(
    chunks: ContextChunk[],
    config: any,
    targetTokens: number,
  ): Promise<{
    chunks: ContextChunk[];
    chunksRemoved: number;
    chunksCompressed: number;
  }> {
    const compressedChunks: ContextChunk[] = [];
    let chunksCompressed = 0;

    for (const chunk of chunks) {
      if (chunk.tokenCount > 100) {
        // Only compress longer chunks
        const compressionResult = await this.compressChunkContent(chunk, config);

        if (compressionResult.compressed) {
          compressedChunks.push({
            ...chunk,
            content: compressionResult.compressedContent,
            tokenCount: compressionResult.compressedTokens,
            metadata: {
              ...chunk.metadata,
              compressed: true,
              originalTokenCount: chunk.tokenCount,
              compressionRatio: compressionResult.compressionRatio,
            },
          });
          chunksCompressed++;
        } else {
          compressedChunks.push(chunk);
        }
      } else {
        compressedChunks.push(chunk);
      }
    }

    return {
      chunks: compressedChunks,
      chunksRemoved: 0,
      chunksCompressed,
    };
  }

  /**
   * Remove semantically duplicate information
   */
  private async applySemanticDeduplication(
    chunks: ContextChunk[],
    config: any,
  ): Promise<{
    chunks: ContextChunk[];
    chunksRemoved: number;
    chunksCompressed: number;
  }> {
    if (!config.conceptClustering) {
      return { chunks, chunksRemoved: 0, chunksCompressed: 0 };
    }

    // Group chunks by semantic concepts
    const conceptGroups = new Map<string, ContextChunk[]>();

    for (const chunk of chunks) {
      const concept = this.extractMainConcept(chunk);
      if (!conceptGroups.has(concept)) {
        conceptGroups.set(concept, []);
      }
      conceptGroups.get(concept)!.push(chunk);
    }

    // For each concept group, keep only the most relevant chunk
    const deduplicatedChunks: ContextChunk[] = [];
    for (const [concept, groupChunks] of conceptGroups) {
      if (groupChunks.length === 1) {
        deduplicatedChunks.push(groupChunks[0]);
      } else {
        // Keep the chunk with highest relevance score
        const bestChunk = groupChunks.reduce((best, current) =>
          current.relevanceScore > best.relevanceScore ? current : best,
        );
        deduplicatedChunks.push(bestChunk);
      }
    }

    return {
      chunks: deduplicatedChunks,
      chunksRemoved: chunks.length - deduplicatedChunks.length,
      chunksCompressed: 0,
    };
  }

  /**
   * Trim chunks to fit within token limit
   */
  private async trimToTokenLimit(
    chunks: ContextChunk[],
    maxTokens: number,
  ): Promise<ContextChunk[]> {
    // Sort by relevance score descending
    const sortedChunks = chunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const selectedChunks: ContextChunk[] = [];
    let currentTokens = 0;

    for (const chunk of sortedChunks) {
      if (currentTokens + chunk.tokenCount <= maxTokens) {
        selectedChunks.push(chunk);
        currentTokens += chunk.tokenCount;
      } else {
        // Try to fit a compressed version
        const remainingTokens = maxTokens - currentTokens;
        if (remainingTokens > 50) {
          // Minimum useful chunk size
          const truncatedChunk = {
            ...chunk,
            content: this.truncateContent(chunk.content, remainingTokens),
            tokenCount: remainingTokens,
            metadata: {
              ...chunk.metadata,
              truncated: true,
              originalTokenCount: chunk.tokenCount,
            },
          };
          selectedChunks.push(truncatedChunk);
          currentTokens += remainingTokens;
        }
        break;
      }
    }

    return selectedChunks;
  }

  /**
   * Compress individual chunk content
   */
  private async compressChunkContent(
    chunk: ContextChunk,
    config: any,
  ): Promise<ContextCompressionResult> {
    const originalContent = chunk.content;
    const originalTokens = chunk.tokenCount;

    // Simple compression: remove redundant phrases and verbose language
    let compressedContent = originalContent;

    // Remove common verbose phrases
    const verbosePhrases = [
      'it is important to note that',
      'it should be noted that',
      'it is worth mentioning that',
      'as previously mentioned',
      'in conclusion',
      'to summarize',
      'in summary',
      'additionally',
      'furthermore',
      'moreover',
    ];

    for (const phrase of verbosePhrases) {
      compressedContent = compressedContent.replace(new RegExp(phrase, 'gi'), '');
    }

    // Remove excessive whitespace
    compressedContent = compressedContent.replace(/\s+/g, ' ').trim();

    // Calculate new token count (rough approximation)
    const compressedTokens = Math.ceil(compressedContent.length / 4);
    const compressionRatio = compressedTokens / originalTokens;

    // Only use compression if it meets quality criteria
    if (compressionRatio <= config.maxCompressionRatio && compressedTokens < originalTokens) {
      return {
        compressed: true,
        originalContent,
        compressedContent,
        originalTokens,
        compressedTokens,
        compressionRatio,
        qualityPreserved: this.estimateCompressionQuality(originalContent, compressedContent),
      };
    }

    return {
      compressed: false,
      originalContent,
      compressedContent: originalContent,
      originalTokens,
      compressedTokens: originalTokens,
      compressionRatio: 1,
      qualityPreserved: 1,
    };
  }

  // Helper methods

  private mergeStrategies(
    customStrategies: Partial<OptimizationStrategy>[],
  ): OptimizationStrategy[] {
    const strategyMap = new Map<string, OptimizationStrategy>();

    // Add defaults
    for (const strategy of this.defaultStrategies) {
      strategyMap.set(strategy.name, { ...strategy });
    }

    // Override with custom strategies
    for (const custom of customStrategies) {
      if (custom.name) {
        const existing = strategyMap.get(custom.name);
        if (existing) {
          strategyMap.set(custom.name, { ...existing, ...custom });
        }
      }
    }

    return Array.from(strategyMap.values()).sort((a, b) => a.priority - b.priority);
  }

  private calculateSemanticSimilarity(chunk1: ContextChunk, chunk2: ContextChunk): number {
    // Simple word overlap similarity (in production, use embeddings)
    const words1 = new Set(chunk1.content.toLowerCase().split(/\s+/));
    const words2 = new Set(chunk2.content.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private calculateTemporalScore(timestamp: Date, now: number, config: any): number {
    const ageInHours = (now - timestamp.getTime()) / (1000 * 60 * 60);
    return Math.exp(-ageInHours / (24 * 7 * config.ageDecayFactor)); // Exponential decay
  }

  private extractMainConcept(chunk: ContextChunk): string {
    // Simple concept extraction based on content
    const content = chunk.content.toLowerCase();

    // Look for common business concepts
    const concepts = [
      'booking',
      'reservation',
      'payment',
      'customer',
      'hotel',
      'room',
      'check-in',
      'check-out',
      'confirmation',
      'cancellation',
    ];

    for (const concept of concepts) {
      if (content.includes(concept)) {
        return concept;
      }
    }

    return 'general'; // Default concept
  }

  private truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (content.length <= maxChars) return content;

    return content.substring(0, maxChars - 3) + '...';
  }

  private calculateOverallRelevance(chunks: ContextChunk[]): number {
    if (chunks.length === 0) return 0;

    const totalScore = chunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0);
    return totalScore / chunks.length;
  }

  private estimateCompressionQuality(original: string, compressed: string): number {
    // Simple quality estimation based on content preservation
    const originalWords = original.split(/\s+/).length;
    const compressedWords = compressed.split(/\s+/).length;

    if (compressedWords === 0) return 0;

    return Math.min(1.0, compressedWords / originalWords);
  }
}
