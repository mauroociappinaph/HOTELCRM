import { Injectable, Logger } from '@nestjs/common';
import {
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  MemoryQuery,
  MemoryResult,
} from '@hotel-crm/shared';
import { MemoryRepositoryPort } from '../../domain/ports/memory-repository.port';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';

@Injectable()
export class SupabaseMemoryRepositoryAdapter implements MemoryRepositoryPort {
  private readonly logger = new Logger(SupabaseMemoryRepositoryAdapter.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async storeEpisodic(
    memory: Omit<
      EpisodicMemory,
      'id' | 'createdAt' | 'updatedAt' | 'consolidationCount' | 'lastAccessed' | 'accessCount'
    >,
  ): Promise<string> {
    const client = this.supabaseService.getClient();

    const dbRecord = {
      user_id: memory.userId,
      agency_id: memory.agencyId,
      session_id: memory.sessionId,
      interaction_type: memory.interactionType,
      content: memory.content,
      context: memory.context,
      outcome: memory.outcome,
      importance: memory.importance,
      timestamp: new Date().toISOString(),
      consolidation_count: 0,
      last_accessed: new Date().toISOString(),
      access_count: 0,
    };

    const { data, error } = await client
      .from('episodic_memories')
      .insert(dbRecord)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async queryEpisodic(query: MemoryQuery): Promise<MemoryResult[]> {
    const client = this.supabaseService.getClient();
    let dbQuery = client
      .from('episodic_memories')
      .select('*')
      .eq('agency_id', query.agencyId)
      .order('importance', { ascending: false })
      .order('timestamp', { ascending: false })
      .limit(query.limit || 10);

    if (query.userId) {
      dbQuery = dbQuery.eq('user_id', query.userId);
    }

    if (query.timeRange) {
      dbQuery = dbQuery
        .gte('timestamp', query.timeRange.start.toISOString())
        .lte('timestamp', query.timeRange.end.toISOString());
    }

    const { data, error } = await dbQuery;
    if (error) throw error;

    return (data || []).map((memory) => ({
      type: 'episodic',
      content: this.mapEpisodicFromDb(memory),
      relevanceScore: 0, // Should be calculated by service
      recencyScore: 0,   // Should be calculated by service
      importanceScore: memory.importance,
    }));
  }

  async consolidateEpisodic(userId: string, agencyId: string, threshold: number): Promise<void> {
    const client = this.supabaseService.getClient();
    
    // This method is complex, for now we mark as consolidated
    // The actual logic of pattern extraction stays in the service
    const { error } = await client
      .from('episodic_memories')
      .update({ consolidation_count: threshold })
      .eq('user_id', userId)
      .eq('agency_id', agencyId)
      .gte('access_count', threshold);

    if (error) throw error;
  }

  async storeSemantic(
    memory: Omit<SemanticMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>,
  ): Promise<string> {
    const client = this.supabaseService.getClient();

    // Check if concept already exists
    const { data: existing } = await client
      .from('semantic_memories')
      .select('id, facts, relationships, confidence, access_count')
      .eq('agency_id', memory.agencyId)
      .eq('concept', memory.concept)
      .eq('category', memory.category)
      .single();

    if (existing) {
      const { data, error } = await client
        .from('semantic_memories')
        .update({
          facts: [...new Set([...existing.facts, ...memory.facts])],
          relationships: memory.relationships, // Simplification for now
          confidence: Math.max(existing.confidence, memory.confidence),
          last_updated: new Date().toISOString(),
          access_count: existing.access_count + 1,
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } else {
      const { data, error } = await client
        .from('semantic_memories')
        .insert({
          agency_id: memory.agencyId,
          concept: memory.concept,
          category: memory.category,
          facts: memory.facts,
          relationships: memory.relationships,
          confidence: memory.confidence,
          source: memory.source,
          last_updated: new Date().toISOString(),
          access_count: 0,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    }
  }

  async querySemantic(query: MemoryQuery): Promise<MemoryResult[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('semantic_memories')
      .select('*')
      .eq('agency_id', query.agencyId)
      .order('confidence', { ascending: false })
      .limit(query.limit || 5);

    if (error) throw error;

    return (data || []).map((memory) => ({
      type: 'semantic',
      content: this.mapSemanticFromDb(memory),
      relevanceScore: 0,
      recencyScore: 0,
      importanceScore: memory.confidence,
    }));
  }

  async storeProcedural(
    memory: Omit<ProceduralMemory, 'id' | 'createdAt' | 'updatedAt' | 'lastUsed' | 'usageCount'>,
  ): Promise<string> {
    const client = this.supabaseService.getClient();

    const dbRecord = {
      agency_id: memory.agencyId,
      task_type: memory.taskType,
      pattern: memory.pattern,
      steps: memory.steps,
      success_rate: memory.successRate,
      average_duration: memory.averageDuration,
      prerequisites: memory.prerequisites,
      outcomes: memory.outcomes,
      last_used: new Date().toISOString(),
      usage_count: 0,
    };

    const { data, error } = await client
      .from('procedural_memories')
      .insert(dbRecord)
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async queryProcedural(query: MemoryQuery): Promise<MemoryResult[]> {
    const client = this.supabaseService.getClient();

    const { data, error } = await client
      .from('procedural_memories')
      .select('*')
      .eq('agency_id', query.agencyId)
      .eq('task_type', query.query)
      .order('success_rate', { ascending: false })
      .order('usage_count', { ascending: false })
      .limit(query.limit || 3);

    if (error) throw error;

    return (data || []).map((memory) => ({
      type: 'procedural',
      content: this.mapProceduralFromDb(memory),
      relevanceScore: memory.success_rate,
      recencyScore: 0,
      importanceScore: memory.success_rate,
    }));
  }

  // Mappers
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
      createdAt: new Date(db.timestamp),
      updatedAt: new Date(db.timestamp),
      consolidationCount: db.consolidation_count,
      lastAccessed: new Date(db.last_accessed),
      accessCount: db.access_count,
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
      createdAt: new Date(db.last_updated),
      updatedAt: new Date(db.last_updated),
      accessCount: db.access_count,
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
      createdAt: new Date(db.last_used),
      updatedAt: new Date(db.last_used),
      lastUsed: new Date(db.last_used),
      usageCount: db.usage_count,
    };
  }
}
