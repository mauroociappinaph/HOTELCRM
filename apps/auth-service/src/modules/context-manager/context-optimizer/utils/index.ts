// Context Optimizer Utilities - Funciones puras y helpers (SRP compliant)
import type { ContextChunk, ContextCompressionResult } from '../types';

/**
 * Calculate semantic similarity between two context chunks using simple word overlap
 * Pure function - no side effects, deterministic
 */
export function calculateSemanticSimilarity(chunk1: ContextChunk, chunk2: ContextChunk): number {
  const words1 = new Set(chunk1.content.toLowerCase().split(/\s+/));
  const words2 = new Set(chunk2.content.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate temporal score based on content age and decay factor
 * Pure function - mathematical calculation only
 */
export function calculateTemporalScore(timestamp: Date, now: number, config: any): number {
  const ageInHours = (now - timestamp.getTime()) / (1000 * 60 * 60);
  return Math.exp(-ageInHours / (24 * 7 * config.ageDecayFactor)); // Exponential decay
}

/**
 * Extract main concept from chunk content for categorization
 * Pure function - text analysis only
 */
export function extractMainConcept(chunk: ContextChunk): string {
  const content = chunk.content.toLowerCase();

  // Business concepts relevant to HOTELCRM
  const concepts = [
    'booking', 'reservation', 'payment', 'customer', 'hotel', 'room',
    'check-in', 'check-out', 'confirmation', 'cancellation',
    'user', 'profile', 'account', 'authentication', 'authorization',
    'dashboard', 'analytics', 'report', 'metric', 'statistic',
    'context', 'optimization', 'compression', 'chunk', 'token',
    'ai', 'chat', 'conversation', 'message', 'response'
  ];

  for (const concept of concepts) {
    if (content.includes(concept)) {
      return concept;
    }
  }

  return 'general'; // Default concept
}

/**
 * Truncate content to fit within token limit
 * Pure function - string manipulation only
 */
export function truncateContent(content: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (content.length <= maxChars) return content;

  return content.substring(0, maxChars - 3) + '...';
}

/**
 * Calculate overall relevance score from chunk array
 * Pure function - mathematical aggregation
 */
export function calculateOverallRelevance(chunks: ContextChunk[]): number {
  if (chunks.length === 0) return 0;

  const totalScore = chunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0);
  return totalScore / chunks.length;
}

/**
 * Estimate compression quality preservation
 * Pure function - quality metrics calculation
 */
export function estimateCompressionQuality(original: string, compressed: string): number {
  const originalWords = original.split(/\s+/).length;
  const compressedWords = compressed.split(/\s+/).length;

  if (compressedWords === 0) return 0;

  return Math.min(1.0, compressedWords / originalWords);
}

/**
 * Merge custom strategies with default ones
 * Pure function - configuration merging
 */
export function mergeStrategies(customStrategies: any[]): any[] {
  // Default strategies would be defined here
  const defaultStrategies = [
    {
      name: 'redundancy-elimination',
      description: 'Remove duplicate and highly similar content',
      priority: 1,
      isEnabled: true,
      config: { similarityThreshold: 0.85 }
    }
    // ... other defaults
  ];

  const strategyMap = new Map();

  // Add defaults
  for (const strategy of defaultStrategies) {
    strategyMap.set(strategy.name, { ...strategy });
  }

  // Override with custom strategies
  for (const custom of customStrategies || []) {
    if (custom.name) {
      const existing = strategyMap.get(custom.name);
      if (existing) {
        strategyMap.set(custom.name, { ...existing, ...custom });
      }
    }
  }

  return Array.from(strategyMap.values()).sort((a, b) => a.priority - b.priority);
}

/**
 * Validate optimization configuration
 * Pure function - input validation
 */
export function validateOptimizationConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.targetTokens || config.targetTokens <= 0) {
    errors.push('targetTokens must be a positive number');
  }

  if (config.strategies && !Array.isArray(config.strategies)) {
    errors.push('strategies must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
