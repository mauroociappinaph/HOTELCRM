import { Injectable, Logger } from '@nestjs/common';
import {
  ChatSession,
  ChatMessage,
  Option,
  ConversationOptions,
  AiUsageLog,
  AiRecommendation,
} from '@hotel-crm/shared';
import { ChatRepositoryPort } from '../../domain/ports/chat-repository.port';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';

@Injectable()
export class SupabaseChatRepositoryAdapter implements ChatRepositoryPort {
  private readonly logger = new Logger(SupabaseChatRepositoryAdapter.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async findById(id: string): Promise<Option<ChatSession>> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('ai_chat_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return { some: false, value: undefined };
      throw error;
    }

    return { some: true, value: this.mapSessionFromDb(data) };
  }

  async findAll(filter?: Partial<ChatSession>): Promise<ChatSession[]> {
    const client = this.supabaseService.getClient();
    let query = client.from('ai_chat_sessions').select('*');

    if (filter?.userId) query = query.eq('user_id', filter.userId);
    if (filter?.agencyId) query = query.eq('agency_id', filter.agencyId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(this.mapSessionFromDb);
  }

  async create(session: Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt' | 'lastActivity'>): Promise<ChatSession> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('ai_chat_sessions')
      .insert({
        user_id: session.userId,
        agency_id: session.agencyId,
        session_name: session.title,
        status: session.status || 'active',
        metadata: session.metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapSessionFromDb(data);
  }

  async update(id: string, entity: Partial<ChatSession>): Promise<Option<ChatSession>> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('ai_chat_sessions')
      .update({
        session_name: entity.title,
        status: entity.status,
        metadata: entity.metadata,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { some: true, value: this.mapSessionFromDb(data) };
  }

  async delete(id: string): Promise<boolean> {
    const client = this.supabaseService.getClient();
    const { error } = await client.from('ai_chat_sessions').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async exists(id: string): Promise<boolean> {
    const { count } = await this.supabaseService.getClient()
      .from('ai_chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('id', id);
    return (count || 0) > 0;
  }

  async count(filter?: Partial<ChatSession>): Promise<number> {
    const { count } = await this.supabaseService.getClient()
      .from('ai_chat_sessions')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  }

  async findOne(filter: Partial<ChatSession>): Promise<Option<ChatSession>> {
    const sessions = await this.findAll(filter);
    return sessions.length > 0 ? { some: true, value: sessions[0] } : { some: false, value: undefined };
  }

  async findMany(filter: Partial<ChatSession>, options?: any): Promise<ChatSession[]> {
    return this.findAll(filter);
  }

  async paginate(filter: Partial<ChatSession>, options: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async search(query: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async findByUserId(userId: string): Promise<ChatSession[]> {
    return this.findAll({ userId });
  }

  async findActiveSession(userId: string): Promise<Option<ChatSession>> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('ai_chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return { some: false, value: undefined };
    return { some: true, value: this.mapSessionFromDb(data) };
  }

  async saveMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client
      .from('ai_chat_messages')
      .insert({
        session_id: sessionId,
        role: message.role,
        content: message.content,
        tokens_used: message.tokens,
        metadata: message.metadata,
      });

    if (error) throw error;
  }

  async getConversationHistory(sessionId: string, options?: ConversationOptions): Promise<ChatMessage[]> {
    const client = this.supabaseService.getClient();
    let query = client
      .from('ai_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(this.mapMessageFromDb);
  }

  async updateSessionStats(sessionId: string, tokens: number, cost: number): Promise<void> {
    const client = this.supabaseService.getClient();
    
    const { data: current } = await client
      .from('ai_chat_sessions')
      .select('total_tokens, total_cost')
      .eq('id', sessionId)
      .single();

    if (current) {
      await client
        .from('ai_chat_sessions')
        .update({
          total_tokens: (current.total_tokens || 0) + tokens,
          total_cost: (current.total_cost || 0) + cost,
          last_activity: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }
  }

  async logUsage(log: Omit<AiUsageLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client
      .from('ai_usage_logs')
      .insert({
        agency_id: log.agencyId,
        user_id: log.userId,
        service_type: log.serviceType,
        model_used: log.modelUsed,
        tokens_used: log.tokensUsed,
        cost_usd: log.costUsd,
        request_data: log.requestData,
        response_data: log.responseData,
      });

    if (error) throw error;
  }

  async saveRecommendation(rec: Omit<AiRecommendation, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client
      .from('ai_recommendations')
      .insert({
        agency_id: rec.agencyId,
        user_id: rec.userId,
        recommendation_type: rec.recommendationType,
        title: rec.title,
        description: rec.description,
        confidence_score: rec.confidenceScore,
        metadata: rec.metadata,
      });

    if (error) throw error;
  }

  private mapSessionFromDb(db: any): ChatSession {
    return {
      id: db.id,
      userId: db.user_id,
      agencyId: db.agency_id,
      title: db.session_name,
      status: db.status,
      metadata: db.metadata || {},
      lastActivity: new Date(db.last_activity || db.created_at),
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.updated_at),
    };
  }

  private mapMessageFromDb(db: any): ChatMessage {
    return {
      id: db.id,
      sessionId: db.session_id,
      role: db.role,
      content: db.content,
      tokens: db.tokens_used,
      metadata: db.metadata || {},
      createdAt: new Date(db.created_at),
      updatedAt: new Date(db.created_at),
    };
  }
}
