// Multi-Agent Coordinator Types - Centralizado según Clean Architecture
export interface Agent {
  id: string;
  name: string;
  role: string;
  specialty: string;
  capabilities: string[];
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  isActive: boolean;
}

export interface AgentTask {
  id: string;
  agentId: string;
  taskType: 'search' | 'analyze' | 'synthesize' | 'validate' | 'execute';
  priority: 'low' | 'medium' | 'high' | 'critical';
  input: any;
  context?: any; // QueryContext type to be imported
  dependencies?: string[];
  timeout: number;
  retryCount: number;
  maxRetries: number;
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  status: 'success' | 'failure' | 'timeout' | 'cancelled';
  output: any;
  confidence: number;
  processingTime: number;
  tokensUsed: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface CoordinationPlan {
  planId: string;
  mainTask: string;
  subtasks: AgentTask[];
  executionOrder: string[][];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
  fallbackStrategies: string[];
}

export interface TaskAnalysis {
  complexity: 'simple' | 'medium' | 'complex';
  requiredCapabilities: string[];
  estimatedSteps: number;
  domain: string;
}

export interface CoordinationStats {
  totalCoordinations: number;
  averageConfidence: number;
  averageProcessingTime: number;
  successRate: number;
  agentPerformance: Record<string, { tasks: number; avgConfidence: number }>;
}

// Re-export from context-assembler for convenience
export type { QueryContext } from '../../context-assembler.service';
