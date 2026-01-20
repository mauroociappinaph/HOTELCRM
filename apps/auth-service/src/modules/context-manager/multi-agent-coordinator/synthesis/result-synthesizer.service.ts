// Result Synthesizer Service - SRP: Combinar y sintetizar resultados de tareas
import { Injectable, Logger } from '@nestjs/common';
import type { TaskResult, QueryContext } from '../types';

@Injectable()
export class ResultSynthesizerService {
  private readonly logger = new Logger(ResultSynthesizerService.name);

  /**
   * Synthesize final answer from all task results
   */
  async synthesizeFinalAnswer(
    results: TaskResult[],
    mainTask: string,
    context: QueryContext,
    createTask: (task: any) => any,
    executeTask: (task: any, timeout: number) => Promise<TaskResult>
  ): Promise<string> {
    const successfulResults = results.filter(r => r.status === 'success');

    if (successfulResults.length === 0) {
      return 'Lo siento, no pude completar la tarea solicitada. Todos los intentos fallaron.';
    }

    // For simple tasks, return the best result directly
    if (successfulResults.length === 1) {
      return successfulResults[0].output;
    }

    // For complex tasks, use synthesis agent
    try {
      const synthesisTask = createTask({
        agentId: 'synthesis-agent',
        taskType: 'synthesize',
        priority: 'high',
        input: {
          mainTask,
          results: successfulResults.map(r => ({
            agent: r.agentId,
            output: r.output,
            confidence: r.confidence
          })),
          context,
        },
        timeout: 30000,
        maxRetries: 1,
      });

      const synthesisResult = await executeTask(synthesisTask, 30000);
      return synthesisResult.output || successfulResults[0].output;
    } catch (error) {
      this.logger.warn('Synthesis failed, using best individual result:', error);
      const bestResult = successfulResults.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
      return bestResult.output;
    }
  }

  /**
   * Calculate overall confidence from all results
   */
  calculateOverallConfidence(
    results: TaskResult[],
    getTask: (taskId: string) => any
  ): number {
    const successfulResults = results.filter(r => r.status === 'success');

    if (successfulResults.length === 0) return 0;

    // Weighted average based on task type importance
    const weights: Record<string, number> = {
      search: 0.3,
      analyze: 0.3,
      synthesize: 0.25,
      validate: 0.15,
      execute: 0.2,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const result of successfulResults) {
      const task = getTask(result.taskId);
      const taskType = task?.taskType || 'search';
      const weight = weights[taskType] || 0.25;

      weightedSum += result.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Extract confidence from agent response
   */
  extractConfidenceFromResponse(response: string): number {
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
