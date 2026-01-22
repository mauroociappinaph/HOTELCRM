/**
 * AI Module Interfaces
 * Strictly typed definitions for AI-driven operations
 */

export interface ChatMetadata {
  tokensUsed?: number;
  modelName?: string;
  latencyMs?: number;
  sourceFiles?: string[];
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: ChatMetadata;
}

export interface ChatSession {
  id: string;
  userId: string;
  title?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: ChatMetadata;
}

export interface ChatHistoryResponse {
  sessionId: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }>;
}
