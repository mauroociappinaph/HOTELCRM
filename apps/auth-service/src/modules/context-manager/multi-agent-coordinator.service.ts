// Multi-Agent Coordinator Service - Pure Orchestrator (Regla del 300)
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { ContextAssemblerService } from './context-assembler.service';

// Clean Architecture: Modular orchestration
import type {
  AgentTask,
  TaskResult,
  CoordinationPlan,
  CoordinationStats,
  QueryContext
} from './multi-agent-coordinator/types';

import { AgentRegistryService } from './multi-agent-coordinator/agents';
import { TaskManagerService } from './multi-agent-coordinator/tasks';
import { TaskExecutorService } from './multi-agent-coordinator/execution';
import { ResultSynthesizerService } from './multi-agent-coordinator/synthesis';

@Injectable()
export class MultiAgentCoordinatorService {
  private readonly logger = new Logger(MultiAgentCoordinatorService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly contextAssembler: ContextAssemblerService,
    private readonly agentRegistry: AgentRegistryService,
    private readonly taskManager: TaskManagerService,
    private readonly taskExecutor: TaskExecutorService,
    private readonly resultSynthesizer: ResultSynthesizerService,
  ) {}

  /**
   * Main coordination method - Clean orchestrator pattern
   * Delegates to specialized modules following SRP
   */
  async coordinateTask(
    mainTask: string,
    context: QueryContext,
    options: {
      maxParallelTasks?: number;
      timeout?: number;
      riskTolerance?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<{
    plan: CoordinationPlan;
    results: TaskResult[];
    finalAnswer: string;
    confidence: number;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const plan = await this.createCoordinationPlan(mainTask, context, options);

    this.logger.log(`🎯 Starting coordinated task execution: ${mainTask}`);

    try {
      const results = await this.executeCoordinationPlan(plan, options);
      const finalAnswer = await this.resultSynthesizer.synthesizeFinalAnswer(
        results,
        mainTask,
        context,
        (task) => this.taskManager.createTask(task),
        (task, timeout) => this.executeAgentTask(task, timeout)
      );
      const confidence = this.resultSynthesizer.calculateOverallConfidence(
        results,
        (taskId) => this.taskManager.getTask(taskId)
      );

      const processingTime = Date.now() - startTime;

      // Store coordination results using Supabase
      await this.storeCoordinationResults(plan.planId, results, finalAnswer, confidence);

      return {
        plan,
        results,
        finalAnswer,
        confidence,
        processingTime,
      };
    } catch (error) {
      this.logger.error('Error in multi-agent coordination:', error);
      throw error;
    }
  }

  /**
   * Create coordination plan using TaskManager
   */
  private async createCoordinationPlan(
    mainTask: string,
    context: QueryContext,
    options: any
  ): Promise<CoordinationPlan> {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Use TaskManager for analysis and decomposition
    const taskAnalysis = this.taskManager.analyzeTaskComplexity(mainTask, context);
    const subtasks = this.taskManager.decomposeTask(mainTask, taskAnalysis, context);

    // Calculate execution order with dependencies
    const executionOrder = this.taskManager.calculateExecutionOrder(subtasks);

    // Estimate duration and risk
    const estimatedDuration = this.estimateExecutionTime(subtasks);
    const riskLevel = this.assessRiskLevel(subtasks, context);

    const plan: CoordinationPlan = {
      planId,
      mainTask,
      subtasks,
      executionOrder,
      estimatedDuration,
      riskLevel,
      fallbackStrategies: this.generateFallbackStrategies(riskLevel),
    };

    this.logger.log(`📋 Created coordination plan with ${subtasks.length} subtasks`);
    return plan;
  }

  /**
   * Execute coordination plan with parallel processing
   */
  private async executeCoordinationPlan(
    plan: CoordinationPlan,
    options: any
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const maxParallel = options.maxParallelTasks || 3;

    for (const taskGroup of plan.executionOrder) {
      // Execute tasks in parallel within each group
      const groupPromises = taskGroup.slice(0, maxParallel).map(async (taskId) => {
        const task = plan.subtasks.find(t => t.id === taskId);
        if (!task) throw new Error(`Task ${taskId} not found in plan`);

        return this.executeAgentTask(task, options.timeout || 30000);
      });

      const groupResults = await Promise.allSettled(groupPromises);

      for (let i = 0; i < groupResults.length; i++) {
        const result = groupResults[i];
        const taskId = taskGroup[i];

        if (result.status === 'fulfilled') {
          results.push(result.value);
          this.taskManager.storeTaskResult(result.value);
        } else {
          // Handle task failure
          const failedTask = plan.subtasks.find(t => t.id === taskId)!;
          const failedResult: TaskResult = {
            taskId,
            agentId: failedTask.agentId,
            status: 'failure',
            output: null,
            confidence: 0,
            processingTime: 0,
            tokensUsed: 0,
            error: result.reason?.message || 'Task execution failed',
          };

          results.push(failedResult);
          this.taskManager.storeTaskResult(failedResult);
        }
      }
    }

    return results;
  }

  /**
   * Execute individual agent task using TaskExecutor with retry logic
   */
  private async executeAgentTask(task: AgentTask, timeout: number): Promise<TaskResult> {
    const agent = this.agentRegistry.getAgent(task.agentId);

    if (!agent || !agent.isActive) {
      throw new Error(`Agent ${task.agentId} not available`);
    }

    // Use TaskExecutor for execution with built-in retry logic
    return this.taskExecutor.executeTaskWithRetry(
      task,
      agent,
      (taskId) => this.taskManager.incrementRetryCount(taskId)
    );
  }





  /**
   * Store coordination results for learning
   */
  private async storeCoordinationResults(
    planId: string,
    results: TaskResult[],
    finalAnswer: string,
    confidence: number
  ): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      await client.from('multi_agent_coordinations').insert({
        plan_id: planId,
        results: results,
        final_answer: finalAnswer,
        overall_confidence: confidence,
        processing_time: results.reduce((sum, r) => sum + r.processingTime, 0),
        total_tokens: results.reduce((sum, r) => sum + r.tokensUsed, 0),
        created_at: new Date(),
      });
    } catch (error) {
      this.logger.warn('Failed to store coordination results:', error);
    }
  }

  /**
   * Get coordination statistics
   */
  async getCoordinationStats(): Promise<CoordinationStats> {
    try {
      const client = this.supabaseService.getClient();

      const { data } = await client
        .from('multi_agent_coordinations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!data || data.length === 0) {
        return {
          totalCoordinations: 0,
          averageConfidence: 0,
          averageProcessingTime: 0,
          successRate: 0,
          agentPerformance: {},
        };
      }

      const totalCoordinations = data.length;
      const averageConfidence = data.reduce((sum, c) => sum + c.overall_confidence, 0) / totalCoordinations;
      const averageProcessingTime = data.reduce((sum, c) => sum + c.processing_time, 0) / totalCoordinations;
      const successRate = data.filter(c => c.overall_confidence > 0.7).length / totalCoordinations;

      // Calculate agent performance from TaskManager
      const taskStats = this.taskManager.getTaskStats();
      const agentStats = this.agentRegistry.getAgentStats();

      return {
        totalCoordinations,
        averageConfidence,
        averageProcessingTime,
        successRate,
        agentPerformance: {}, // Could be enhanced with detailed stats
      };
    } catch (error) {
      this.logger.error('Error getting coordination stats:', error);
      throw error;
    }
  }

  // Helper methods (pure functions)
  private estimateExecutionTime(subtasks: AgentTask[]): number {
    return subtasks.reduce((total, task) => {
      const agent = this.agentRegistry.getAgent(task.agentId);
      const baseTime = agent ? 10000 : 15000;
      return total + baseTime + (task.timeout * 0.1);
    }, 0);
  }

  private assessRiskLevel(subtasks: AgentTask[], context: QueryContext): 'low' | 'medium' | 'high' {
    if (subtasks.length > 5 || context.urgency === 'critical') return 'high';
    if (subtasks.length > 2 || context.urgency === 'high') return 'medium';
    return 'low';
  }

  private generateFallbackStrategies(riskLevel: string): string[] {
    const strategies = ['retry_failed_tasks', 'use_backup_agent'];
    if (riskLevel === 'high') {
      strategies.push('escalate_to_human', 'simplify_task');
    }
    return strategies;
  }

  private extractConfidenceFromResponse(response: string): number {
    const confidenceMatch = response.match(/confidence:?\s*(\d+(?:\.\d+)?)/i);
    if (confidenceMatch) {
      return Math.min(1.0, Math.max(0.0, parseFloat(confidenceMatch[1])));
    }

    let confidence = 0.7;
    const hasUncertainWords = /\b(maybe|perhaps|possibly|might|could|unsure)\b/i.test(response);
    const hasCertainWords = /\b(definitely|certainly|clearly|obviously|definite)\b/i.test(response);

    if (hasUncertainWords) confidence -= 0.2;
    if (hasCertainWords) confidence += 0.1;

    return Math.min(1.0, Math.max(0.3, confidence));
  }
}
