import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface EpisodicMemory {
  id: string;
  userId: string;
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
  async storeEpisodicMemory(memory: Omit<EpisodicMemory, 'id' | 'consolidationCount' | 'lastAccessed' | 'accessCount'>): Promise<string> {
    try {
      const client = this.supabaseService.getClient();

      const episodicMemory = {
        ...memory,
        consolidationCount: 0,
        lastAccessed: new Date(),
        accessCount: 0,
      };

      const { data, error } = await client
        .from('episodic_memories')
        .insert(episodicMemory)
        .select('id')
        .single();

      if (error) throw error;

      // Update cache
      this.updateEpisodicCache(memory.userId, { ...episodicMemory, id: data.id });

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
  async storeSemanticMemory(memory: Omit<SemanticMemory, 'id' | 'lastUpdated' | 'accessCount'>): Promise<string> {
    try {
      const client = this.supabaseService.getClient();

      // Check if concept already exists
      const { data: existing } = await client
        .from('semantic_memories')
        .select('*')
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
          lastUpdated: new Date(),
          accessCount: existing.accessCount + 1,
        };

        const { error } = await client
          .from('semantic_memories')
          .update(updatedMemory)
          .eq('id', existing.id);

        if (error) throw error;

        this.semanticCache.set(existing.id, updatedMemory);
        return existing.id;
      } else {
        // Create new memory
        const newMemory = {
          ...memory,
          lastUpdated: new Date(),
          accessCount: 0,
        };

        const { data, error } = await client
          .from('semantic_memories')
          .insert(newMemory)
          .select('id')
          .single();

        if (error) throw error;

        this.semanticCache.set(data.id, { ...newMemory, id: data.id });
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
  async storeProceduralMemory(memory: Omit<ProceduralMemory, 'id' | 'lastUsed' | 'usageCount'>): Promise<string> {
    try {
      const client = this.supabaseService.getClient();

      const proceduralMemory = {
        ...memory,
        lastUsed: new Date(),
        usageCount: 0,
      };

      const { data, error } = await client
        .from('procedural_memories')
        .insert(proceduralMemory)
        .select('id')
        .single();

      if (error) throw error;

      // Update cache
      this.updateProceduralCache(memory.taskType, { ...proceduralMemory, id: data.id });

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
  async consolidateMemories(userId: string): Promise<void> {
    try {
      // Consolidate episodic memories
      await this.consolidateEpisodicMemories(userId);

      // Extract semantic knowledge from episodic memories
      await this.extractSemanticFromEpisodic(userId);

      // Update procedural patterns
      await this.updateProceduralPatterns(userId);

      this.logger.log(`Memory consolidation completed for user ${userId}`);
    } catch (error) {
      this.logger.error('Error consolidating memories:', error);
      throw error;
    }
  }

  /**
   * Selective forgetting based on importance and recency
   */
  async applySelectiveForgetting(userId: string): Promise<void> {
    try {
      const client = this.supabaseService.getClient();
      const cutoffDate = new Date(Date.now() - this.forgettingThreshold * 24 * 60 * 60 * 1000);

      // Identify low-importance old memories for forgetting
      const { data: episodicToForget } = await client
        .from('episodic_memories')
        .select('id')
        .eq('user_id', userId)
        .lt('timestamp', cutoffDate)
        .lt('importance', 0.3)
        .lt('access_count', 3);

      if (episodicToForget && episodicToForget.length > 0) {
        await client
          .from('episodic_memories')
          .delete()
          .in('id', episodicToForget.map(m => m.id));

        this.logger.log(`Forgot ${episodicToForget.length} low-importance episodic memories`);
      }

      // Clean up semantic memories with low confidence
      const { data: semanticToForget } = await client
        .from('semantic_memories')
        .select('id')
        .lt('confidence', 0.2)
        .lt('access_count', 2);

      if (semanticToForget && semanticToForget.length > 0) {
        await client
          .from('semantic_memories')
          .delete()
          .in('id', semanticToForget.map(m => m.id));

        this.logger.log(`Forgot ${semanticToForget.length} low-confidence semantic memories`);
      }

    } catch (error) {
      this.logger.error('Error applying selective forgetting:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics for monitoring
   */
  async getMemoryStats(userId: string): Promise<{
    episodic: { count: number; avgImportance: number; totalAccesses: number };
    semantic: { count: number; avgConfidence: number; totalAccesses: number };
    procedural: { count: number; avgSuccessRate: number; totalUsage: number };
  }> {
    try {
      const client = this.supabaseService.getClient();

      // Episodic stats
      const { data: episodicData } = await client
        .from('episodic_memories')
        .select('importance, access_count')
        .eq('user_id', userId);

      const episodicStats = episodicData ? {
        count: episodicData.length,
        avgImportance: episodicData.reduce((sum, m) => sum + m.importance, 0) / episodicData.length,
        totalAccesses: episodicData.reduce((sum, m) => sum + m.access_count, 0),
      } : { count: 0, avgImportance: 0, totalAccesses: 0 };

      // Semantic stats
      const { data: semanticData } = await client
        .from('semantic_memories')
        .select('confidence, access_count');

      const semanticStats = semanticData ? {
        count: semanticData.length,
        avgConfidence: semanticData.reduce((sum, m) => sum + m.confidence, 0) / semanticData.length,
        totalAccesses: semanticData.reduce((sum, m) => sum + m.access_count, 0),
      } : { count: 0, avgConfidence: 0, totalAccesses: 0 };

      // Procedural stats
      const { data: proceduralData } = await client
        .from('procedural_memories')
        .select('success_rate, usage_count');

      const proceduralStats = proceduralData ? {
        count: proceduralData.length,
        avgSuccessRate: proceduralData.reduce((sum, m) => sum + m.success_rate, 0) / proceduralData.length,
        totalUsage: proceduralData.reduce((sum, m) => sum + m.usage_count, 0),
      } : { count: 0, avgSuccessRate: 0, totalUsage: 0 };

      return {
        episodic: episodicStats,
        semantic: semanticStats,
        procedural: proceduralStats,
      };
    } catch (error) {
      this.logger.error('Error getting memory stats:', error);
      throw error;
    }
  }

  // Private helper methods

  private async queryEpisodicMemories(query: MemoryQuery): Promise<MemoryResult[]> {
    const client = this.supabaseService.getClient();
    let dbQuery = client
      .from('episodic_memories')
      .select('*')
      .eq('user_id', query.userId!)
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

    return (data || []).map(memory => ({
      type: 'episodic' as const,
      content: memory,
      relevanceScore: this.calculateEpisodicRelevance(memory, query.query),
      recencyScore: this.calculateRecencyScore(memory.timestamp),
      importanceScore: memory.importance,
    }));
  }

  private async querySemanticMemories(query: MemoryQuery): Promise<MemoryResult[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('semantic_memories')
      .select('*')
      .order('confidence', { ascending: false })
      .limit(query.limit || 5);

    if (error) throw error;

    return (data || [])
      .map((memory: SemanticMemory) => ({
        type: 'semantic' as const,
        content: memory,
        relevanceScore: this.calculateSemanticRelevance(memory, query.query),
        recencyScore: this.calculateRecencyScore(memory.lastUpdated),
        importanceScore: memory.confidence,
      }))
      .filter(result => result.relevanceScore >= (query.minRelevance || 0.3));
  }

  private async queryProceduralMemories(query: MemoryQuery): Promise<MemoryResult[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('procedural_memories')
      .select('*')
      .eq('task_type', query.query) // Assuming query contains task type
      .order('success_rate', { ascending: false })
      .order('usage_count', { ascending: false })
      .limit(query.limit || 3);

    if (error) throw error;

    return (data || []).map(memory => ({
      type: 'procedural',
      content: memory,
      relevanceScore: memory.successRate,
      recencyScore: this.calculateRecencyScore(memory.lastUsed),
      importanceScore: memory.successRate * (memory.usageCount / 10), // Normalize usage
    }));
  }

  private async consolidateEpisodicMemories(userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    const { data: memoriesToConsolidate } = await client
      .from('episodic_memories')
      .select('*')
      .eq('user_id', userId)
      .gte('access_count', this.consolidationThreshold)
      .eq('outcome', 'success');

    if (!memoriesToConsolidate) return;

    // Group by interaction type and extract patterns
    const patterns = this.extractPatternsFromMemories(memoriesToConsolidate);

    for (const pattern of patterns) {
      await this.storeSemanticMemory({
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
      .update({ consolidationCount: this.consolidationThreshold })
      .in('id', memoriesToConsolidate.map(m => m.id));
  }

  private async extractSemanticFromEpisodic(userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // Extract user preferences and behaviors
    const { data: recentInteractions } = await client
      .from('episodic_memories')
      .select('content, context, interaction_type')
      .eq('user_id', userId)
      .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      .limit(100);

    if (!recentInteractions) return;

    // Extract semantic knowledge from patterns
    const semanticKnowledge = this.extractSemanticKnowledge(recentInteractions);

    for (const knowledge of semanticKnowledge) {
      await this.storeSemanticMemory(knowledge);
    }
  }

  private async updateProceduralPatterns(userId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // Analyze successful task patterns
    const { data: taskMemories } = await client
      .from('episodic_memories')
      .select('content, context, outcome, interaction_type')
      .eq('user_id', userId)
      .eq('interaction_type', 'task')
      .eq('outcome', 'success')
      .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
      .limit(200);

    if (!taskMemories) return;

    const taskPatterns = this.analyzeTaskPatterns(taskMemories);

    for (const pattern of taskPatterns) {
      await this.storeProceduralMemory({
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

  private calculateEpisodicRelevance(memory: EpisodicMemory, query: string): number {
    // Simple text similarity for now
    const content = memory.content.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/);

    let matches = 0;
    for (const word of queryWords) {
      if (content.includes(word)) matches++;
    }

    return Math.min(1.0, matches / queryWords.length);
  }

  private calculateSemanticRelevance(memory: SemanticMemory, query: string): number {
    // Check concept relevance
    if (memory.concept.toLowerCase().includes(query.toLowerCase())) {
      return memory.confidence;
    }

    // Check facts relevance
    for (const fact of memory.facts) {
      if (fact.toLowerCase().includes(query.toLowerCase())) {
        return memory.confidence * 0.8;
      }
    }

    return 0.1; // Low baseline relevance
  }

  private calculateRecencyScore(timestamp: Date): number {
    const hoursSince = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
    return Math.exp(-hoursSince / (24 * 7)); // Exponential decay over weeks
  }

  private mergeRelationships(
    existing: SemanticMemory['relationships'],
    newRelationships: SemanticMemory['relationships']
  ): SemanticMemory['relationships'] {
    const merged = new Map<string, any>();

    // Add existing relationships
    for (const rel of existing) {
      merged.set(`${rel.relatedConcept}-${rel.relationshipType}`, rel);
    }

    // Merge new relationships
    for (const rel of newRelationships) {
      const key = `${rel.relatedConcept}-${rel.relationshipType}`;
      if (merged.has(key)) {
        // Average the strengths
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
    relationships: SemanticMemory['relationships'];
    confidence: number;
  }> {
    // Simple pattern extraction - in production, use ML
    const patterns = new Map<string, any>();

    for (const memory of memories) {
      const content = memory.content.toLowerCase();

      // Extract simple patterns (this is a simplified implementation)
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

  private extractSemanticKnowledge(interactions: any[]): Array<Omit<SemanticMemory, 'id' | 'lastUpdated' | 'accessCount'>> {
    // Extract user preferences and behavior patterns
    const knowledge: Array<Omit<SemanticMemory, 'id' | 'lastUpdated' | 'accessCount'>> = [];

    // Example: Extract preferred communication style
    const communicationPatterns = interactions.filter(i => i.interaction_type === 'conversation');
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
    // Group memories by task type
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
      if (taskMemories.length >= 3) { // Need at least 3 examples
        patterns.push({
          taskType,
          pattern: `Successful ${taskType} execution pattern`,
          steps: ['Analyze requirements', 'Execute task', 'Verify results'],
          successRate: taskMemories.length / taskMemories.length, // All are successful
          averageDuration: 300000, // 5 minutes average (placeholder)
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

    // Keep cache size manageable
    if (userMemories.length > this.cacheMaxSize) {
      userMemories.shift(); // Remove oldest
    }
  }

  private updateProceduralCache(taskType: string, memory: ProceduralMemory): void {
    if (!this.proceduralCache.has(taskType)) {
      this.proceduralCache.set(taskType, []);
    }

    const taskMemories = this.proceduralCache.get(taskType)!;
    taskMemories.push(memory);

    // Keep only top 10 most successful patterns
    if (taskMemories.length > 10) {
      taskMemories.sort((a, b) => b.successRate - a.successRate);
      taskMemories.splice(10);
    }
  }
}
