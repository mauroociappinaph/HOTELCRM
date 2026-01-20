// Base Strategy Interface - Foundation for all optimization strategies
import type { ContextChunk } from '../types';

export interface StrategyResult {
  chunks: ContextChunk[];
  chunksRemoved: number;
  chunksCompressed: number;
}

export interface OptimizationConfig {
  [key: string]: any;
}

/**
 * Abstract base class for all optimization strategies
 * Implements Strategy Pattern for pluggable optimization algorithms
 */
export abstract class BaseOptimizationStrategy {
  protected readonly name: string;
  protected readonly config: OptimizationConfig;

  constructor(name: string, config: OptimizationConfig = {}) {
    this.name = name;
    this.config = { ...this.getDefaultConfig(), ...config };
  }

  /**
   * Execute the optimization strategy
   */
  abstract execute(chunks: ContextChunk[]): Promise<StrategyResult>;

  /**
   * Get default configuration for this strategy
   */
  protected abstract getDefaultConfig(): OptimizationConfig;

  /**
   * Validate strategy configuration
   */
  protected validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  /**
   * Get strategy metadata
   */
  getMetadata() {
    return {
      name: this.name,
      config: this.config,
      isValid: this.validateConfig().valid
    };
  }
}
