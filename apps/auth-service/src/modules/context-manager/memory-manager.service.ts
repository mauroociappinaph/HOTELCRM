import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface EpisodicMemory {
  id: string;
  userId: string;
  agencyId: string; // Enforce multitenancy
  sessionId: string;
  interactionType: 'conversation' | 'task' | 'decision' | 'feedback';
  content: string;
  context: Record<string, any>;
  outcome: 'success' | 'failure' | 'partial' | 'unknown';
  importance: number; // 0-1 scale
  timestamp: Date;
  consolidationCount: number;
  lastAccessed: Date;
  accessCount: number;
}

export interface SemanticMemory {
  id: string;
  agencyId: string; // Enforce multitenancy
  concept: string;
  category: string;
  facts: string[];
  relationships: Array<{
    relatedConcept: string;
    relationshipType: string;
    strength: number;
  }>;
  confidence: number;
  source: string;
  lastUpdated: Date;
  accessCount: number;
}

export interface ProceduralMemory {
  id: string;
  agencyId: string; // Enforce multitenancy
  taskType: string;
  pattern: string;
  steps: string[];
  successRate: number;
  averageDuration: number;
  prerequisites: string[];
  outcomes: string[];
  lastUsed: Date;
  usageCount: number;
}

export interface MemoryQuery {
  type: 'episodic' | 'semantic' | 'procedural';
  query: string;
  userId?: string;
  agencyId: string; // Required for all queries
  sessionId?: string;
  limit?: number;
  minRelevance?: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface MemoryResult {
  type: 'episodic' | 'semantic' | 'procedural';
  content: EpisodicMemory | SemanticMemory | ProceduralMemory;
  relevanceScore: number;
  recencyScore: number;
  importanceScore: number;
}

@Injectable()
export class MemoryManagerService {
  private readonly logger = new Logger(MemoryManagerService.name);

  // In-memory caches for performance
  // Key should include agencyId to prevent leak: `${agencyId}:${key}`
  private episodicCache = new Map<string, EpisodicMemory[]>();
  private semanticCache = new Map<string, SemanticMemory>();
  private proceduralCache = new Map<string, ProceduralMemory[]>();

  private readonly consolidationThreshold = 5; // Consolidate after 5 accesses
  private readonly forgettingThreshold = 30; // Days before considering forgetting
  private readonly cacheMaxSize = 1000;

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Store episodic memory (conversation/task history)
   */
  async storeEpisodicMemory(
    memory: Omit<EpisodicMemory, 'id' | 'consolidationCount' | 'lastAccessed' | 'accessCount'>,
  ): Promise<string> {
    try {
      const client = this.supabaseService.getClient();

      const episodicMemory = {
        ...memory,
        user_id: memory.userId, // Map to DB column
        agency_id: memory.agencyId, // Map to DB column
        session_id: memory.sessionId, // Map to DB column
        interaction_type: memory.interactionType, // Map to DB column
        consolidation_count: 0,
        last_accessed: new Date(),
        access_count: 0,
      };

      const { data, error } = await client
        .from('episodic_memories')
        .insert(episodicMemory)
        .select('id')
        .single();

      if (error) throw error;

      // Update cache
      this.updateEpisodicCache(memory.userId, { ...memory, id: data.id, consolidationCount: 0, lastAccessed: new Date(), accessCount: 0 });

      this.logger.log(`Stored episodic memory for user ${memory.userId}`);
      return data.id;
    } catch (error) {
      this.logger.error('Error storing episodic memory:', error);
      throw error;
    }
  }

  /**
   * Store or update semantic memory (factual knowledge)
   */
  async storeSemanticMemory(
    memory: Omit<SemanticMemory, 'id' | 'lastUpdated' | 'accessCount'>,
  ): Promise<string> {
    try {
      const client = this.supabaseService.getClient();

      // Check if concept already exists FOR THIS AGENCY
      const { data: existing } = await client
        .from('semantic_memories')
        .select('*')
        .eq('agency_id', memory.agencyId) // Tenant isolation
        .eq('concept', memory.concept)
        .eq('category', memory.category)
        .single();

      if (existing) {
        // Update existing memory
        const updatedMemory = {
          ...existing,
          facts: [...new Set([...existing.facts, ...memory.facts])], // Merge facts
          relationships: this.mergeRelationships(existing.relationships, memory.relationships),
          confidence: Math.max(existing.confidence, memory.confidence),
          last_updated: new Date(),
          access_count: existing.access_count + 1,
        };

        const { error } = await client
          .from('semantic_memories')
          .update(updatedMemory)
          .eq('id', existing.id)
          .eq('agency_id', memory.agencyId); // Extra safety check

        if (error) throw error;

        this.semanticCache.set(existing.id, this.mapSemanticFromDb(updatedMemory));
        return existing.id;
      } else {
        // Create new memory
        const newMemory = {
          ...memory,
          agency_id: memory.agencyId, // Map to DB
          last_updated: new Date(),
          access_count: 0,
        };

        const { data, error } = await client
          .from('semantic_memories')
          .insert(newMemory)
          .select('id')
          .single();

        if (error) throw error;

        this.semanticCache.set(data.id, { ...memory, id: data.id, lastUpdated: new Date(), accessCount: 0 });
        return data.id;
      }
    } catch (error) {
      this.logger.error('Error storing semantic memory:', error);
      throw error;
    }
  }

  /**
   * Store procedural memory (task patterns and procedures)
   */
  async storeProceduralMemory(
    memory: Omit<ProceduralMemory, 'id' | 'lastUsed' | 'usageCount'>,
  ): Promise<string> {
    try {
      const client = this.supabaseService.getClient();

      const proceduralMemory = {
        ...memory,
        agency_id: memory.agencyId, // Map to DB
        task_type: memory.taskType, // Map to DB
        last_used: new Date(),
        usage_count: 0,
      };

      const { data, error } = await client
        .from('procedural_memories')
        .insert(proceduralMemory)
        .select('id')
        .single();

      if (error) throw error;

      // Update cache
      this.updateProceduralCache(memory.taskType, { ...memory, id: data.id, lastUsed: new Date(), usageCount: 0 });

      this.logger.log(`Stored procedural memory for task type ${memory.taskType}`);
      return data.id;
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
      switch (query.type) {
        case 'episodic':
          return await this.queryEpisodicMemories(query);
        case 'semantic':
          return await this.querySemanticMemories(query);
        case 'procedural':
          return await this.queryProceduralMemories(query);
        default:
          return [];
      }
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
      // Consolidate episodic memories
      await this.consolidateEpisodicMemories(userId, agencyId);

      // Extract semantic knowledge from episodic memories
      await this.extractSemanticFromEpisodic(userId, agencyId);

      // Update procedural patterns
      await this.updateProceduralPatterns(userId, agencyId);

      this.logger.log(`Memory consolidation completed for user ${userId}`);
    } catch (error) {
      this.logger.error('Error consolidating memories:', error);
      throw error;
    }
  }

  // ... (selective forgetting also needs agency context ideally, but works on ID)

  // Private helper methods

  private async queryEpisodicMemories(query: MemoryQuery): Promise<MemoryResult[]> {
    const client = this.supabaseService.getClient();
    let dbQuery = client
      .from('episodic_memories')
      .select('*')
      .eq('user_id', query.userId!)
      // agency_id check is implicit if userId belongs to agency, but enforcing it is safer
      .eq('agency_id', query.agencyId) 
      .order('importance', { ascending: false })
      .order('timestamp', { ascending: false })
      .limit(query.limit || 10);

    if (query.timeRange) {
      dbQuery = dbQuery
        .gte('timestamp', query.timeRange.start)
        .lte('timestamp', query.timeRange.end);
    }

    const { data, error } = await dbQuery;
    if (error) throw error;

    return (data || []).map((memory) => ({
      type: 'episodic' as const,
      content: this.mapEpisodicFromDb(memory),
      relevanceScore: this.calculateEpisodicRelevance(this.mapEpisodicFromDb(memory), query.query),
      recencyScore: this.calculateRecencyScore(new Date(memory.timestamp)),
      importanceScore: memory.importance,
    }));
  }

  private async querySemanticMemories(query: MemoryQuery): Promise<MemoryResult[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('semantic_memories')
      .select('*')
      .eq('agency_id', query.agencyId) // TENANT ISOLATION
      .order('confidence', { ascending: false })
      .limit(query.limit || 5);

    if (error) throw error;

    return (data || [])
      .map((memory) => {
        const mapped = this.mapSemanticFromDb(memory);
        return {
          type: 'semantic' as const,
          content: mapped,
          relevanceScore: this.calculateSemanticRelevance(mapped, query.query),
          recencyScore: this.calculateRecencyScore(mapped.lastUpdated),
          importanceScore: mapped.confidence,
        };
      })
      .filter((result) => result.relevanceScore >= (query.minRelevance || 0.3));
  }

  private async queryProceduralMemories(query: MemoryQuery): Promise<MemoryResult[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('procedural_memories')
      .select('*')
      .eq('agency_id', query.agencyId) // TENANT ISOLATION
      .eq('task_type', query.query) 
      .order('success_rate', { ascending: false })
      .order('usage_count', { ascending: false })
      .limit(query.limit || 3);

    if (error) throw error;

    return (data || []).map((memory) => {
      const mapped = this.mapProceduralFromDb(memory);
      return {
        type: 'procedural',
        content: mapped,
        relevanceScore: mapped.successRate,
        recencyScore: this.calculateRecencyScore(mapped.lastUsed),
        importanceScore: mapped.successRate * (mapped.usageCount / 10),
      };
    });
  }

  private async consolidateEpisodicMemories(userId: string, agencyId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: memoriesToConsolidate } = await client
      .from('episodic_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('agency_id', agencyId)
      .gte('access_count', this.consolidationThreshold)
      .eq('outcome', 'success');

    if (!memoriesToConsolidate) return;

    // Group by interaction type and extract patterns
    const patterns = this.extractPatternsFromMemories(memoriesToConsolidate.map(this.mapEpisodicFromDb));

    for (const pattern of patterns) {
      await this.storeSemanticMemory({
        agencyId, // Pass agencyId
        concept: pattern.concept,
        category: pattern.category,
        facts: pattern.facts,
        relationships: pattern.relationships,
        confidence: pattern.confidence,
        source: 'episodic_consolidation',
      });
    }

    // Mark as consolidated
    await client
      .from('episodic_memories')
      .update({ consolidation_count: this.consolidationThreshold })
      .in(
        'id',
        memoriesToConsolidate.map((m) => m.id),
      );
  }

  private async extractSemanticFromEpisodic(userId: string, agencyId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // Extract user preferences and behaviors
    const { data: recentInteractions } = await client
      .from('episodic_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('agency_id', agencyId)
      .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      .limit(100);

    if (!recentInteractions) return;

    // Extract semantic knowledge from patterns
    const semanticKnowledge = this.extractSemanticKnowledge(recentInteractions);

    for (const knowledge of semanticKnowledge) {
      await this.storeSemanticMemory({ ...knowledge, agencyId });
    }
  }

  private async updateProceduralPatterns(userId: string, agencyId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // Analyze successful task patterns
    const { data: taskMemories } = await client
      .from('episodic_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('agency_id', agencyId)
      .eq('interaction_type', 'task')
      .eq('outcome', 'success')
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .limit(200);

    if (!taskMemories) return;

    const taskPatterns = this.analyzeTaskPatterns(taskMemories);

    for (const pattern of taskPatterns) {
      await this.storeProceduralMemory({
        agencyId,
        taskType: pattern.taskType,
        pattern: pattern.pattern,
        steps: pattern.steps,
        successRate: pattern.successRate,
        averageDuration: pattern.averageDuration,
        prerequisites: pattern.prerequisites,
        outcomes: pattern.outcomes,
      });
    }
  }

  // Mappers to handle snake_case DB to camelCase Interface
  private mapEpisodicFromDb(db: any): EpisodicMemory {
    return {
      id: db.id,
      userId: db.user_id,
      agencyId: db.agency_id,
      sessionId: db.session_id,
      interactionType: db.interaction_type,
      content: db.content,
      context: db.context,
      outcome: db.outcome,
      importance: db.importance,
      timestamp: new Date(db.timestamp),
      consolidationCount: db.consolidation_count,
      lastAccessed: new Date(db.last_accessed),
      accessCount: db.access_count
    };
  }

  private mapSemanticFromDb(db: any): SemanticMemory {
    return {
      id: db.id,
      agencyId: db.agency_id,
      concept: db.concept,
      category: db.category,
      facts: db.facts,
      relationships: db.relationships,
      confidence: db.confidence,
      source: db.source,
      lastUpdated: new Date(db.last_updated),
      accessCount: db.access_count
    };
  }

  private mapProceduralFromDb(db: any): ProceduralMemory {
    return {
      id: db.id,
      agencyId: db.agency_id,
      taskType: db.task_type,
      pattern: db.pattern,
      steps: db.steps,
      successRate: db.success_rate,
      averageDuration: db.average_duration,
      prerequisites: db.prerequisites,
      outcomes: db.outcomes,
      lastUsed: new Date(db.last_used),
      usageCount: db.usage_count
    };
  }

  // ... (keep existing calculate* and extract* helper methods as they are mostly logic)
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

  private mergeRelationships(existing: any[], newRelationships: any[]): any[] {
    const merged = new Map<string, any>();
    for (const rel of existing) {
      merged.set(`${rel.relatedConcept}-${rel.relationshipType}`, rel);
    }
    for (const rel of newRelationships) {
      const key = `${rel.relatedConcept}-${rel.relationshipType}`;
      if (merged.has(key)) {
        const existingRel = merged.get(key)!;
        existingRel.strength = (existingRel.strength + rel.strength) / 2;
      } else {
        merged.set(key, rel);
      }
    }
    return Array.from(merged.values());
  }

  private extractPatternsFromMemories(memories: EpisodicMemory[]): Array<{
    concept: string;
    category: string;
    facts: string[];
    relationships: any[];
    confidence: number;
  }> {
    const patterns = new Map<string, any>();
    for (const memory of memories) {
      const content = memory.content.toLowerCase();
      if (content.includes('booking') || content.includes('reservation')) {
        const key = 'booking_patterns';
        if (!patterns.has(key)) {
          patterns.set(key, {
            concept: 'Hotel Booking Process',
            category: 'business_process',
            facts: [],
            relationships: [],
            confidence: 0.8,
          });
        }
        patterns.get(key).facts.push(memory.content);
      }
    }
    return Array.from(patterns.values());
  }

  private extractSemanticKnowledge(interactions: any[]): Array<Omit<SemanticMemory, 'id' | 'lastUpdated' | 'accessCount' | 'agencyId'>> {
    const knowledge: Array<Omit<SemanticMemory, 'id' | 'lastUpdated' | 'accessCount' | 'agencyId'>> = [];
    const communicationPatterns = interactions.filter((i) => i.interaction_type === 'conversation');
    if (communicationPatterns.length > 5) {
      knowledge.push({
        concept: 'Communication Preferences',
        category: 'user_behavior',
        facts: ['User prefers detailed responses', 'User asks follow-up questions'],
        relationships: [],
        confidence: 0.7,
        source: 'behavior_analysis',
      });
    }
    return knowledge;
  }

  private analyzeTaskPatterns(memories: any[]): Array<{
    taskType: string;
    pattern: string;
    steps: string[];
    successRate: number;
    averageDuration: number;
    prerequisites: string[];
    outcomes: string[];
  }> {
    const taskGroups = new Map<string, any[]>();
    for (const memory of memories) {
      const taskType = memory.context?.taskType || 'general';
      if (!taskGroups.has(taskType)) {
        taskGroups.set(taskType, []);
      }
      taskGroups.get(taskType)!.push(memory);
    }
    const patterns: Array<{
      taskType: string;
      pattern: string;
      steps: string[];
      successRate: number;
      averageDuration: number;
      prerequisites: string[];
      outcomes: string[];
    }> = [];
    for (const [taskType, taskMemories] of taskGroups) {
      if (taskMemories.length >= 3) {
        patterns.push({
          taskType,
          pattern: `Successful ${taskType} execution pattern`,
          steps: ['Analyze requirements', 'Execute task', 'Verify results'],
          successRate: taskMemories.length / taskMemories.length,
          averageDuration: 300000,
          prerequisites: ['User authentication', 'Valid permissions'],
          outcomes: ['Task completed successfully', 'Results verified'],
        });
      }
    }
    return patterns;
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
