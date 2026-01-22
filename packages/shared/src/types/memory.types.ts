/**
 * Memory System Types for HOTELCRM
 * Enterprise-grade memory abstractions for AI systems
 */

import { BaseEntity } from './repository.types';

export type InteractionType = 'conversation' | 'task' | 'decision' | 'feedback';
export type MemoryOutcome = 'success' | 'failure' | 'partial' | 'unknown';
export type MemoryType = 'episodic' | 'semantic' | 'procedural';

export interface EpisodicMemory extends BaseEntity {
  userId: string;
  agencyId: string;
  sessionId: string;
  interactionType: InteractionType;
  content: string;
  context: Record<string, unknown>;
  outcome: MemoryOutcome;
  importance: number; // 0-1 scale
  consolidationCount: number;
  lastAccessed: Date;
  accessCount: number;
}

export interface SemanticMemory extends BaseEntity {
  agencyId: string;
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
  accessCount: number;
}

export interface ProceduralMemory extends BaseEntity {
  agencyId: string;
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
  type: MemoryType;
  query: string;
  userId?: string;
  agencyId: string;
  sessionId?: string;
  limit?: number;
  minRelevance?: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface MemoryResult {
  type: MemoryType;
  content: EpisodicMemory | SemanticMemory | ProceduralMemory;
  relevanceScore: number;
  recencyScore: number;
  importanceScore: number;
}
