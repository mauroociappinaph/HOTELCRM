import { Injectable, Logger } from '@nestjs/common';
import {
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  MemoryQuery,
  MemoryResult,
} from '@hotel-crm/shared';

import { MemoryRepositoryPort } from './domain/ports/memory-repository.port';

@Injectable()
export class MemoryManagerService {
  private readonly logger = new Logger(MemoryManagerService.name);

  // In-memory caches for performance
  private episodicCache = new Map<string, EpisodicMemory[]>();
  private semanticCache = new Map<string, SemanticMemory>();
  private proceduralCache = new Map<string, ProceduralMemory[]>();

  private readonly consolidationThreshold = 5;
  private readonly cacheMaxSize = 1000;

  constructor(private readonly memoryRepository: MemoryRepositoryPort) {}

  /**
   * Store episodic memory (conversation/task history)
   */
  async storeEpisodicMemory(
    memory: Omit<
      EpisodicMemory,
      'id' | 'createdAt' | 'updatedAt' | 'consolidationCount' | 'lastAccessed' | 'accessCount'
    >,
  ): Promise<string> {
    try {
      const id = await this.memoryRepository.storeEpisodic(memory);

      // Update cache
      this.updateEpisodicCache(memory.userId, {
        ...memory,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        consolidationCount: 0,
        lastAccessed: new Date(),
        accessCount: 0,
      } as EpisodicMemory);

      this.logger.log(`Stored episodic memory for user ${memory.userId}`);
      return id;
    } catch (error) {
      this.logger.error('Error storing episodic memory:', error);
      throw error;
    }
  }

  /**
   * Store or update semantic memory (factual knowledge)
   */
  async storeSemanticMemory(
    memory: Omit<SemanticMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>,
  ): Promise<string> {
    try {
      const id = await this.memoryRepository.storeSemantic(memory);

      // Simple cache update logic
      this.semanticCache.set(id, {
        ...memory,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessCount: 1,
      } as SemanticMemory);

      return id;
    } catch (error) {
      this.logger.error('Error storing semantic memory:', error);
      throw error;
    }
  }

  /**
   * Store procedural memory (task patterns and procedures)
   */
  async storeProceduralMemory(
    memory: Omit<ProceduralMemory, 'id' | 'createdAt' | 'updatedAt' | 'lastUsed' | 'usageCount'>,
  ): Promise<string> {
    try {
      const id = await this.memoryRepository.storeProcedural(memory);

      // Update cache
      this.updateProceduralCache(memory.taskType, {
        ...memory,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsed: new Date(),
        usageCount: 1,
      } as ProceduralMemory);

      this.logger.log(`Stored procedural memory for task type ${memory.taskType}`);
      return id;
    } catch (error) {
      this.logger.error('Error storing procedural memory:', error);
      throw error;
    }
  }

  /**
   * Query memories based on type and criteria
   */
  async queryMemories(query: MemoryQuery): Promise<MemoryResult[]> {
    try {
      let results: MemoryResult[] = [];

      switch (query.type) {
        case 'episodic':
          results = await this.memoryRepository.queryEpisodic(query);
          results.forEach((r) => {
            r.relevanceScore = this.calculateEpisodicRelevance(
              r.content as EpisodicMemory,
              query.query,
            );
            r.recencyScore = this.calculateRecencyScore(r.content.createdAt);
          });
          break;
        case 'semantic':
          results = await this.memoryRepository.querySemantic(query);
          results.forEach((r) => {
            r.relevanceScore = this.calculateSemanticRelevance(
              r.content as SemanticMemory,
              query.query,
            );
            r.recencyScore = this.calculateRecencyScore(r.content.createdAt);
          });
          break;
        case 'procedural':
          results = await this.memoryRepository.queryProcedural(query);
          break;
      }

      return results.filter((r) => r.relevanceScore >= (query.minRelevance || 0.3));
    } catch (error) {
      this.logger.error('Error querying memories:', error);
      throw error;
    }
  }

  /**
   * Consolidate memories (move from short-term to long-term)
   */
  async consolidateMemories(userId: string, agencyId: string): Promise<void> {
    try {
      await this.memoryRepository.consolidateEpisodic(
        userId,
        agencyId,
        this.consolidationThreshold,
      );
      this.logger.log(`Memory consolidation completed for user ${userId}`);
    } catch (error) {
      this.logger.error('Error consolidating memories:', error);
      throw error;
    }
  }

  private calculateEpisodicRelevance(memory: EpisodicMemory, query: string): number {
    const content = memory.content.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/);
    let matches = 0;
    for (const word of queryWords) {
      if (content.includes(word)) matches++;
    }
    return Math.min(1.0, matches / queryWords.length);
  }

  private calculateSemanticRelevance(memory: SemanticMemory, query: string): number {
    if (memory.concept.toLowerCase().includes(query.toLowerCase())) {
      return memory.confidence;
    }
    for (const fact of memory.facts) {
      if (fact.toLowerCase().includes(query.toLowerCase())) {
        return memory.confidence * 0.8;
      }
    }
    return 0.1;
  }

  private calculateRecencyScore(timestamp: Date): number {
    const hoursSince = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
    return Math.exp(-hoursSince / (24 * 7));
  }

  private updateEpisodicCache(userId: string, memory: EpisodicMemory): void {
    if (!this.episodicCache.has(userId)) {
      this.episodicCache.set(userId, []);
    }
    const userMemories = this.episodicCache.get(userId)!;
    userMemories.push(memory);
    if (userMemories.length > this.cacheMaxSize) {
      userMemories.shift();
    }
  }

  private updateProceduralCache(taskType: string, memory: ProceduralMemory): void {
    if (!this.proceduralCache.has(taskType)) {
      this.proceduralCache.set(taskType, []);
    }
    const taskMemories = this.proceduralCache.get(taskType)!;
    taskMemories.push(memory);
    if (taskMemories.length > 10) {
      taskMemories.sort((a, b) => b.successRate - a.successRate);
      taskMemories.splice(10);
    }
  }
}
