// Context Optimizer Types - Centralizado según Clean Architecture
export interface OptimizationStrategy {
  name: string;
  description: string;
  priority: number;
  isEnabled: boolean;
  config: Record<string, any>;
}

export interface OptimizationResult {
  originalTokens: number;
  optimizedTokens: number;
  compressionRatio: number;
  strategiesApplied: string[];
  chunksRemoved: number;
  chunksCompressed: number;
  qualityImpact: number; // -1 to 1, negative = quality loss, positive = quality gain
}

export interface ContextCompressionResult {
  compressed: boolean;
  originalContent: string;
  compressedContent: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  qualityPreserved: number; // 0-1
}

// Re-export from context-assembler for convenience
export type { ContextChunk, OptimizedContext } from '../../context-assembler.service';
