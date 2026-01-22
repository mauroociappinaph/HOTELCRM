import {
  IMemoryRepository,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  MemoryQuery,
  MemoryResult,
} from '@hotel-crm/shared';

export abstract class MemoryRepositoryPort implements IMemoryRepository {
  // Episodic Memory
  abstract storeEpisodic(
    memory: Omit<
      EpisodicMemory,
      'id' | 'createdAt' | 'updatedAt' | 'consolidationCount' | 'lastAccessed' | 'accessCount'
    >,
  ): Promise<string>;
  abstract queryEpisodic(query: MemoryQuery): Promise<MemoryResult[]>;
  abstract consolidateEpisodic(userId: string, agencyId: string, threshold: number): Promise<void>;

  // Semantic Memory
  abstract storeSemantic(
    memory: Omit<SemanticMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>,
  ): Promise<string>;
  abstract querySemantic(query: MemoryQuery): Promise<MemoryResult[]>;

  // Procedural Memory
  abstract storeProcedural(
    memory: Omit<ProceduralMemory, 'id' | 'createdAt' | 'updatedAt' | 'lastUsed' | 'usageCount'>,
  ): Promise<string>;
  abstract queryProcedural(query: MemoryQuery): Promise<MemoryResult[]>;
}
