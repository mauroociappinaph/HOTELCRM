/**
 * AI System Types for HOTELCRM
 */

import { BaseEntity } from './repository.types';

export interface ContextChunk {
  id: string;
  content: string;
  source: string;
  relevanceScore: number;
  tokenCount: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
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

export interface AiUsageLog extends BaseEntity {
  agencyId: string;
  userId: string;
  serviceType: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
  requestData: Record<string, unknown>;
  responseData: Record<string, unknown>;
}

export interface AiRecommendation extends BaseEntity {
  agencyId: string;
  userId: string;
  recommendationType: string;
  title: string;
  description: string;
  confidenceScore: number;
  metadata: Record<string, unknown>;
}
