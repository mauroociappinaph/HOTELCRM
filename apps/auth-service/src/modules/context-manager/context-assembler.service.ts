import { Injectable, Logger } from '@nestjs/common';

export interface ContextChunk {
  id: string;
  content: string;
  source: string;
  relevanceScore: number;
  tokenCount: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface QueryContext {
  query: string;
  userId: string;
  sessionId: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  domain?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

export interface OptimizedContext {
  chunks: ContextChunk[];
  totalTokens: number;
  compressionRatio: number;
  relevanceScore: number;
  assemblyStrategy: string;
  metadata: {
    assemblyTime: number;
    strategiesUsed: string[];
    pruningStats: {
      originalChunks: number;
      prunedChunks: number;
      redundancyRemoved: number;
    };
  };
}

export interface ContextBudget {
  maxTokens: number;
  targetTokens: number;
  minTokens: number;
  priorityWeights: {
    relevance: number;
    recency: number;
    diversity: number;
    authority: number;
  };
}

@Injectable()
export class ContextAssemblerService {
  private readonly logger = new Logger(ContextAssemblerService.name);

  private readonly defaultBudget: ContextBudget = {
    maxTokens: 8000, // Conservative limit for most models
    targetTokens: 6000,
    minTokens: 1000,
    priorityWeights: {
      relevance: 0.4,
      recency: 0.2,
      diversity: 0.2,
      authority: 0.2,
    },
  };

  /**
   * Assemble optimized context for a query
   */
  async assembleContext(
    availableChunks: ContextChunk[],
    queryContext: QueryContext,
    budget: Partial<ContextBudget> = {}
  ): Promise<OptimizedContext> {
    const startTime = Date.now();
    const finalBudget = { ...this.defaultBudget, ...budget };

    // Phase 1: Initial filtering and scoring
    let scoredChunks = await this.scoreChunks(availableChunks, queryContext);

    // Phase 2: Diversity and redundancy analysis
    scoredChunks = await this.applyDiversityFilter(scoredChunks);

    // Phase 3: Redundancy detection and removal
    scoredChunks = await this.removeRedundancy(scoredChunks);

    // Phase 4: Budget-aware selection
    const selectedChunks = await this.selectOptimalChunks(scoredChunks, finalBudget);

    // Phase 5: Final optimization and compression
    const optimizedChunks = await this.optimizeSelectedChunks(selectedChunks, finalBudget);

    const assemblyTime = Date.now() - startTime;
    const totalTokens = optimizedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const originalTotalTokens = availableChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const compressionRatio = originalTotalTokens > 0 ? totalTokens / originalTotalTokens : 1;

    return {
      chunks: optimizedChunks,
      totalTokens,
      compressionRatio,
      relevanceScore: this.calculateOverallRelevance(optimizedChunks),
      assemblyStrategy: this.determineAssemblyStrategy(queryContext),
      metadata: {
        assemblyTime,
        strategiesUsed: this.getStrategiesUsed(queryContext, finalBudget),
        pruningStats: {
          originalChunks: availableChunks.length,
          prunedChunks: availableChunks.length - optimizedChunks.length,
          redundancyRemoved: scoredChunks.length - selectedChunks.length,
        },
      },
    };
  }

  /**
   * Score chunks based on multiple criteria
   */
  private async scoreChunks(
    chunks: ContextChunk[],
    queryContext: QueryContext
  ): Promise<ContextChunk[]> {
    const scoredChunks = await Promise.all(
      chunks.map(async (chunk) => {
        const scores = await this.calculateMultiDimensionalScore(chunk, queryContext);

        return {
          ...chunk,
          relevanceScore: this.combineScores(scores),
          metadata: {
            ...chunk.metadata,
            individualScores: scores,
          },
        };
      })
    );

    // Sort by combined relevance score
    return scoredChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate multi-dimensional relevance score
   */
  private async calculateMultiDimensionalScore(
    chunk: ContextChunk,
    queryContext: QueryContext
  ): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};

    // 1. Semantic relevance (primary scoring)
    scores.semanticRelevance = await this.calculateSemanticRelevance(chunk, queryContext.query);

    // 2. Conversational relevance
    scores.conversationalRelevance = this.calculateConversationalRelevance(chunk, queryContext);

    // 3. Temporal relevance (recency)
    scores.temporalRelevance = this.calculateTemporalRelevance(chunk);

    // 4. Domain relevance
    scores.domainRelevance = this.calculateDomainRelevance(chunk, queryContext);

    // 5. Authority/quality score
    scores.authorityScore = this.calculateAuthorityScore(chunk);

    // 6. Diversity score (to avoid redundancy)
    scores.diversityScore = 1.0; // Will be adjusted in diversity filter

    return scores;
  }

  /**
   * Calculate semantic relevance using advanced NLP techniques
   */
  private async calculateSemanticRelevance(chunk: ContextChunk, query: string): Promise<number> {
    // Simple implementation - in production, use advanced NLP models
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = chunk.content.toLowerCase().split(/\s+/);

    const querySet = new Set(queryWords);
    const contentSet = new Set(contentWords);

    // Jaccard similarity
    const intersection = new Set([...querySet].filter(x => contentSet.has(x)));
    const union = new Set([...querySet, ...contentSet]);

    const jaccardSimilarity = intersection.size / union.size;

    // BM25-like scoring for term frequency
    const bm25Score = queryWords.reduce((score, word) => {
      const tf = contentWords.filter(w => w === word).length;
      const idf = Math.log(1 + (contentWords.length / (tf + 1)));
      return score + (tf * idf);
    }, 0);

    // Combine scores
    return Math.min(1.0, (jaccardSimilarity * 0.6) + (bm25Score * 0.4));
  }

  /**
   * Calculate conversational relevance based on conversation history
   */
  private calculateConversationalRelevance(chunk: ContextChunk, queryContext: QueryContext): number {
    if (!queryContext.conversationHistory || queryContext.conversationHistory.length === 0) {
      return 0.5; // Neutral score if no conversation history
    }

    // Check if chunk content relates to recent conversation topics
    const recentMessages = queryContext.conversationHistory.slice(-5); // Last 5 messages
    const conversationTopics = this.extractTopicsFromConversation(recentMessages);

    let relevanceScore = 0;
    for (const topic of conversationTopics) {
      if (chunk.content.toLowerCase().includes(topic.toLowerCase())) {
        relevanceScore += 0.2;
      }
    }

    return Math.min(1.0, relevanceScore);
  }

  /**
   * Calculate temporal relevance (recency bias)
   */
  private calculateTemporalRelevance(chunk: ContextChunk): number {
    const now = Date.now();
    const chunkTime = chunk.timestamp.getTime();
    const ageInHours = (now - chunkTime) / (1000 * 60 * 60);

    // Exponential decay: newer content gets higher scores
    // Content from last 24h: score ~1.0
    // Content from last week: score ~0.5
    // Content older than 1 month: score ~0.1
    const decayFactor = Math.exp(-ageInHours / 168); // 168 hours = 1 week
    return Math.max(0.1, decayFactor);
  }

  /**
   * Calculate domain relevance
   */
  private calculateDomainRelevance(chunk: ContextChunk, queryContext: QueryContext): number {
    if (!queryContext.domain) return 0.5;

    // Check if chunk belongs to the same domain
    const chunkDomain = chunk.metadata?.domain || chunk.source;
    const queryDomain = queryContext.domain;

    return chunkDomain === queryDomain ? 1.0 : 0.3;
  }

  /**
   * Calculate authority/quality score
   */
  private calculateAuthorityScore(chunk: ContextChunk): number {
    let score = 0.5; // Base score

    // Source authority
    const highAuthoritySources = ['official_docs', 'expert_review', 'verified_source'];
    if (highAuthoritySources.includes(chunk.source)) {
      score += 0.3;
    }

    // Content quality indicators
    if (chunk.metadata?.hasCitations) score += 0.1;
    if (chunk.metadata?.peerReviewed) score += 0.2;
    if (chunk.metadata?.isLatestVersion) score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * Apply diversity filter to avoid redundant information
   */
  private async applyDiversityFilter(chunks: ContextChunk[]): Promise<ContextChunk[]> {
    if (chunks.length <= 1) return chunks;

    const diverseChunks: ContextChunk[] = [chunks[0]]; // Always include top chunk

    for (let i = 1; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      let isDiverse = true;

      // Check similarity with already selected chunks
      for (const selectedChunk of diverseChunks) {
        const similarity = this.calculateChunkSimilarity(currentChunk, selectedChunk);
        if (similarity > 0.8) { // High similarity threshold
          isDiverse = false;
          break;
        }
      }

      if (isDiverse) {
        diverseChunks.push(currentChunk);
      } else {
        // Reduce diversity score for redundant chunks
        currentChunk.metadata!.individualScores!.diversityScore = 0.3;
      }
    }

    return diverseChunks;
  }

  /**
   * Remove redundant information
   */
  private async removeRedundancy(chunks: ContextChunk[]): Promise<ContextChunk[]> {
    // Use Maximal Marginal Relevance (MMR) to balance relevance and diversity
    const selected: ContextChunk[] = [];
    const remaining = [...chunks];

    while (remaining.length > 0 && selected.length < 10) { // Limit to top 10
      let bestIndex = 0;
      let bestScore = -1;

      for (let i = 0; i < remaining.length; i++) {
        const chunk = remaining[i];
        const relevance = chunk.relevanceScore;
        const redundancy = selected.length > 0
          ? Math.max(...selected.map(selectedChunk =>
              this.calculateChunkSimilarity(chunk, selectedChunk)))
          : 0;

        // MMR score: balance relevance vs diversity
        const mmrScore = 0.7 * relevance - 0.3 * redundancy;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      selected.push(remaining[bestIndex]);
      remaining.splice(bestIndex, 1);
    }

    return selected;
  }

  /**
   * Select optimal chunks within token budget
   */
  private async selectOptimalChunks(
    chunks: ContextChunk[],
    budget: ContextBudget
  ): Promise<ContextChunk[]> {
    let selectedChunks: ContextChunk[] = [];
    let totalTokens = 0;

    // Greedy selection with token budget
    for (const chunk of chunks) {
      if (totalTokens + chunk.tokenCount <= budget.maxTokens) {
        selectedChunks.push(chunk);
        totalTokens += chunk.tokenCount;

        // Stop if we hit target tokens
        if (totalTokens >= budget.targetTokens) {
          break;
        }
      }
    }

    // Ensure minimum tokens if possible
    if (totalTokens < budget.minTokens && chunks.length > selectedChunks.length) {
      const remainingChunks = chunks.slice(selectedChunks.length);
      for (const chunk of remainingChunks) {
        if (totalTokens + chunk.tokenCount <= budget.maxTokens) {
          selectedChunks.push(chunk);
          totalTokens += chunk.tokenCount;

          if (totalTokens >= budget.minTokens) {
            break;
          }
        }
      }
    }

    return selectedChunks;
  }

  /**
   * Final optimization of selected chunks
   */
  private async optimizeSelectedChunks(
    chunks: ContextChunk[],
    budget: ContextBudget
  ): Promise<ContextChunk[]> {
    // Sort by final relevance score
    chunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply final compression if needed
    let totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    if (totalTokens > budget.targetTokens) {
      chunks = await this.compressChunks(chunks, budget.targetTokens);
    }

    return chunks;
  }

  /**
   * Compress chunks to fit token budget
   */
  private async compressChunks(chunks: ContextChunk[], targetTokens: number): Promise<ContextChunk[]> {
    // Simple compression: truncate less important chunks
    let compressedChunks: ContextChunk[] = [];
    let currentTokens = 0;

    for (const chunk of chunks) {
      if (currentTokens + chunk.tokenCount <= targetTokens) {
        compressedChunks.push(chunk);
        currentTokens += chunk.tokenCount;
      } else {
        // Truncate chunk content to fit remaining tokens
        const remainingTokens = targetTokens - currentTokens;
        if (remainingTokens > 100) { // Minimum useful chunk size
          const compressedChunk = {
            ...chunk,
            content: this.truncateContent(chunk.content, remainingTokens),
            tokenCount: remainingTokens,
            metadata: {
              ...chunk.metadata,
              compressed: true,
              originalTokenCount: chunk.tokenCount,
            },
          };
          compressedChunks.push(compressedChunk);
          currentTokens += remainingTokens;
        }
        break;
      }
    }

    return compressedChunks;
  }

  /**
   * Combine multiple scoring dimensions into final relevance score
   */
  private combineScores(scores: Record<string, number>): number {
    const weights = this.defaultBudget.priorityWeights;

    return (
      scores.semanticRelevance * weights.relevance +
      scores.temporalRelevance * weights.recency +
      scores.diversityScore * weights.diversity +
      scores.authorityScore * weights.authority +
      (scores.conversationalRelevance || 0) * 0.1 + // Bonus weight
      (scores.domainRelevance || 0) * 0.1     // Bonus weight
    );
  }

  /**
   * Calculate similarity between two chunks
   */
  private calculateChunkSimilarity(chunk1: ContextChunk, chunk2: ContextChunk): number {
    // Simple cosine similarity approximation using word overlap
    const words1 = new Set(chunk1.content.toLowerCase().split(/\s+/));
    const words2 = new Set(chunk2.content.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Extract topics from conversation history
   */
  private extractTopicsFromConversation(messages: QueryContext['conversationHistory']): string[] {
    const topics = new Set<string>();

    if (!messages) return [];

    for (const message of messages) {
      // Simple keyword extraction (in production, use NLP)
      const words = message.content.toLowerCase().split(/\s+/);
      const importantWords = words.filter(word =>
        word.length > 3 && !this.isStopWord(word)
      );

      importantWords.forEach(word => topics.add(word));
    }

    return Array.from(topics).slice(0, 10); // Limit to top 10 topics
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her'
    ]);
    return stopWords.has(word);
  }

  /**
   * Truncate content to fit token limit
   */
  private truncateContent(content: string, maxTokens: number): string {
    // Rough approximation: ~4 characters per token
    const maxChars = maxTokens * 4;
    if (content.length <= maxChars) return content;

    return content.substring(0, maxChars - 3) + '...';
  }

  /**
   * Calculate overall relevance score for optimized context
   */
  private calculateOverallRelevance(chunks: ContextChunk[]): number {
    if (chunks.length === 0) return 0;

    const totalScore = chunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0);
    return totalScore / chunks.length;
  }

  /**
   * Determine assembly strategy based on query context
   */
  private determineAssemblyStrategy(queryContext: QueryContext): string {
    if (queryContext.urgency === 'critical') return 'priority-first';
    if (queryContext.conversationHistory && queryContext.conversationHistory.length > 5) {
      return 'conversation-aware';
    }
    if (queryContext.domain) return 'domain-focused';
    return 'balanced-optimization';
  }

  /**
   * Get list of strategies used
   */
  private getStrategiesUsed(queryContext: QueryContext, budget: ContextBudget): string[] {
    const strategies = ['semantic-scoring', 'diversity-filter', 'redundancy-removal'];

    if (budget.maxTokens < 4000) strategies.push('aggressive-compression');
    if (queryContext.conversationHistory) strategies.push('conversation-context');
    if (queryContext.domain) strategies.push('domain-filtering');

    return strategies;
  }
}
