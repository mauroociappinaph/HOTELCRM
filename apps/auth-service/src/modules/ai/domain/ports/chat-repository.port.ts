import {
  IChatRepository,
  ChatSession,
  ChatMessage,
  Option,
  ConversationOptions,
  AiUsageLog,
  AiRecommendation,
} from '@hotel-crm/shared';

export abstract class ChatRepositoryPort implements IChatRepository {
  // Base repository methods
  abstract findById(id: string): Promise<Option<ChatSession>>;
  abstract findAll(filter?: Partial<ChatSession>): Promise<ChatSession[]>;
  abstract create(
    entity: Omit<ChatSession, 'id' | 'createdAt' | 'updatedAt' | 'lastActivity'>,
  ): Promise<ChatSession>;
  abstract update(id: string, entity: Partial<ChatSession>): Promise<Option<ChatSession>>;
  abstract delete(id: string): Promise<boolean>;
  abstract exists(id: string): Promise<boolean>;
  abstract count(filter?: Partial<ChatSession>): Promise<number>;

  // Query repository methods
  abstract findOne(filter: Partial<ChatSession>): Promise<Option<ChatSession>>;
  abstract findMany(filter: Partial<ChatSession>, options?: any): Promise<ChatSession[]>;
  abstract paginate(filter: Partial<ChatSession>, options: any): Promise<any>;
  abstract search(query: any): Promise<any>;

  // Chat specific methods
  abstract findByUserId(userId: string): Promise<ChatSession[]>;
  abstract findActiveSession(userId: string): Promise<Option<ChatSession>>;
  abstract saveMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void>;
  abstract getConversationHistory(
    sessionId: string,
    options?: ConversationOptions,
  ): Promise<ChatMessage[]>;

  // Stats and Logs
  abstract updateSessionStats(sessionId: string, tokens: number, cost: number): Promise<void>;
  abstract logUsage(log: Omit<AiUsageLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>;
  abstract saveRecommendation(
    recommendation: Omit<AiRecommendation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void>;
}
