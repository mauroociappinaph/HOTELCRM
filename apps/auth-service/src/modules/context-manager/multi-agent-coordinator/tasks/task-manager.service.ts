// Task Manager Service - SRP: Gestión del ciclo de vida de tareas
import { Injectable, Logger } from '@nestjs/common';
import type { AgentTask, TaskResult, TaskAnalysis, QueryContext } from '../types';

@Injectable()
export class TaskManagerService {
  private readonly logger = new Logger(TaskManagerService.name);
  private readonly activeTasks: Map<string, AgentTask> = new Map();
  private readonly taskResults: Map<string, TaskResult> = new Map();

  /**
   * Create a new task
   */
  createTask(task: Omit<AgentTask, 'id' | 'retryCount'>): AgentTask {
    const newTask: AgentTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      retryCount: 0,
    };

    this.activeTasks.set(newTask.id, newTask);
    this.logger.debug(`📋 Created task: ${newTask.id} (${newTask.taskType})`);
    return newTask;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Update task retry count
   */
  incrementRetryCount(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) return false;

    task.retryCount++;
    this.logger.debug(`🔄 Retry ${task.retryCount}/${task.maxRetries} for task ${taskId}`);
    return true;
  }

  /**
   * Store task result
   */
  storeTaskResult(result: TaskResult): void {
    this.taskResults.set(result.taskId, result);

    // Remove from active tasks if completed
    if (['success', 'failure', 'timeout', 'cancelled'].includes(result.status)) {
      this.activeTasks.delete(result.taskId);
    }

    this.logger.debug(`💾 Stored result for task ${result.taskId}: ${result.status}`);
  }

  /**
   * Get task result by ID
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this.taskResults.get(taskId);
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get all task results
   */
  getAllTaskResults(): TaskResult[] {
    return Array.from(this.taskResults.values());
  }

  /**
   * Clear completed tasks older than specified time
   */
  clearOldTasks(olderThanMs: number = 3600000): number { // 1 hour default
    const cutoffTime = Date.now() - olderThanMs;
    let clearedCount = 0;

    for (const [taskId, task] of this.activeTasks.entries()) {
      // Remove tasks that are too old or have exceeded max retries
      if (task.retryCount >= task.maxRetries) {
        this.activeTasks.delete(taskId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      this.logger.log(`🧹 Cleared ${clearedCount} old/completed tasks`);
    }

    return clearedCount;
  }

  /**
   * Analyze task complexity to determine requirements
   */
  analyzeTaskComplexity(task: string, context: QueryContext): TaskAnalysis {
    // Simple complexity analysis
    const words = task.split(/\s+/).length;
    const hasMultipleQuestions = (task.match(/\?/g) || []).length > 1;
    const requiresResearch = /\b(search|find|analyze|compare|research)\b/i.test(task);
    const requiresSynthesis = /\b(summarize|synthesis|combine|integrate)\b/i.test(task);

    let complexity: 'simple' | 'medium' | 'complex' = 'simple';
    const requiredCapabilities: string[] = [];

    if (words > 50 || hasMultipleQuestions || requiresResearch) {
      complexity = 'medium';
      requiredCapabilities.push('web_search', 'document_retrieval');
    }

    if (requiresSynthesis || (context.conversationHistory && context.conversationHistory.length > 5)) {
      complexity = 'complex';
      requiredCapabilities.push('information_synthesis', 'pattern_recognition');
    }

    return {
      complexity,
      requiredCapabilities,
      estimatedSteps: complexity === 'simple' ? 1 : complexity === 'medium' ? 3 : 5,
      domain: context.domain || 'general',
    };
  }

  /**
   * Decompose complex task into subtasks
   */
  decomposeTask(
    mainTask: string,
    analysis: TaskAnalysis,
    context: QueryContext
  ): AgentTask[] {
    const subtasks: AgentTask[] = [];

    switch (analysis.complexity) {
      case 'simple':
        // Single task for simple queries
        subtasks.push(this.createTask({
          agentId: 'search-agent',
          taskType: 'search',
          priority: 'medium',
          input: { query: mainTask, context },
          timeout: 15000,
          maxRetries: 2,
        }));
        break;

      case 'medium':
        // Search + Analysis
        subtasks.push(
          this.createTask({
            agentId: 'search-agent',
            taskType: 'search',
            priority: 'high',
            input: { query: mainTask, context },
            timeout: 20000,
            maxRetries: 2,
          }),
          this.createTask({
            agentId: 'analysis-agent',
            taskType: 'analyze',
            priority: 'medium',
            input: { query: mainTask, context },
            dependencies: [subtasks[0]?.id], // First task ID
            timeout: 25000,
            maxRetries: 2,
          })
        );
        break;

      case 'complex':
        // Full pipeline: Search → Analysis → Synthesis → Validation
        const timestamp = Date.now();
        const searchTask = this.createTask({
          agentId: 'search-agent',
          taskType: 'search',
          priority: 'high',
          input: { query: mainTask, context },
          timeout: 20000,
          maxRetries: 2,
        });

        const analysisTask = this.createTask({
          agentId: 'analysis-agent',
          taskType: 'analyze',
          priority: 'high',
          input: { query: mainTask, context },
          dependencies: [searchTask.id],
          timeout: 25000,
          maxRetries: 2,
        });

        const synthesisTask = this.createTask({
          agentId: 'synthesis-agent',
          taskType: 'synthesize',
          priority: 'medium',
          input: { query: mainTask, context },
          dependencies: [searchTask.id, analysisTask.id],
          timeout: 30000,
          maxRetries: 2,
        });

        const validationTask = this.createTask({
          agentId: 'validation-agent',
          taskType: 'validate',
          priority: 'low',
          input: { query: mainTask, context },
          dependencies: [synthesisTask.id],
          timeout: 20000,
          maxRetries: 2,
        });

        subtasks.push(searchTask, analysisTask, synthesisTask, validationTask);
        break;
    }

    return subtasks;
  }

  /**
   * Calculate execution order considering dependencies
   */
  calculateExecutionOrder(subtasks: AgentTask[]): string[][] {
    const order: string[][] = [];
    const processed = new Set<string>();
    const processing = new Set<string>();

    const getNextBatch = (): string[] => {
      return subtasks
        .filter(task => !processed.has(task.id))
        .filter(task =>
          !task.dependencies ||
          task.dependencies.every(dep => processed.has(dep))
        )
        .map(task => task.id);
    };

    let batch = getNextBatch();
    while (batch.length > 0) {
      order.push(batch);
      batch.forEach(id => processed.add(id));
      batch = getNextBatch();
    }

    return order;
  }

  /**
   * Get task statistics
   */
  getTaskStats(): {
    activeTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageProcessingTime: number;
  } {
    const allResults = Array.from(this.taskResults.values());
    const completedTasks = allResults.filter(r => r.status === 'success').length;
    const failedTasks = allResults.filter(r => ['failure', 'timeout', 'cancelled'].includes(r.status)).length;

    const successfulResults = allResults.filter(r => r.status === 'success');
    const averageProcessingTime = successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.processingTime, 0) / successfulResults.length
      : 0;

    return {
      activeTasks: this.activeTasks.size,
      completedTasks,
      failedTasks,
      averageProcessingTime,
    };
  }
}
