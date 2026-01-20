// Task Executor Service - SRP: Ejecución individual de tareas
import { Injectable, Logger } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';
import type { AgentTask, TaskResult, Agent } from '../types';

@Injectable()
export class TaskExecutorService {
  private readonly logger = new Logger(TaskExecutorService.name);
  private readonly openRouter: OpenRouter;

  constructor() {
    this.openRouter = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  /**
   * Execute a single agent task
   */
  async executeTask(task: AgentTask, agent: Agent): Promise<TaskResult> {
    const startTime = Date.now();

    if (!agent || !agent.isActive) {
      throw new Error(`Agent ${task.agentId} not available`);
    }

    try {
      const result = await this.callAgentAPI(agent, task, task.timeout);

      const processingTime = Date.now() - startTime;
      const taskResult: TaskResult = {
        taskId: task.id,
        agentId: task.agentId,
        status: 'success',
        output: result.output,
        confidence: result.confidence,
        processingTime,
        tokensUsed: result.tokensUsed,
        metadata: {
          model: agent.model,
          temperature: agent.temperature,
          taskType: task.taskType,
        },
      };

      return taskResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const taskResult: TaskResult = {
        taskId: task.id,
        agentId: task.agentId,
        status: 'failure',
        output: null,
        confidence: 0,
        processingTime,
        tokensUsed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return taskResult;
    }
  }

  /**
   * Execute task with retry logic
   */
  async executeTaskWithRetry(
    task: AgentTask,
    agent: Agent,
    updateRetryCount: (taskId: string) => void
  ): Promise<TaskResult> {
    let currentTask = { ...task };

    while (currentTask.retryCount < currentTask.maxRetries) {
      const result = await this.executeTask(currentTask, agent);

      if (result.status === 'success') {
        return result;
      }

      // Increment retry count and try again
      updateRetryCount(currentTask.id);
      currentTask.retryCount++;

      this.logger.log(`🔄 Retrying task ${currentTask.id} (attempt ${currentTask.retryCount}/${currentTask.maxRetries})`);

      // Add exponential backoff
      const delay = Math.min(1000 * Math.pow(2, currentTask.retryCount), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Final attempt or return last failure
    return this.executeTask(currentTask, agent);
  }

  /**
   * Call agent API with specialized prompts
   */
  private async callAgentAPI(agent: Agent, task: AgentTask, timeout: number): Promise<{
    output: any;
    confidence: number;
    tokensUsed: number;
  }> {
    const taskPrompt = this.buildTaskPrompt(agent, task);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });

    const apiPromise = this.openRouter.chat.send({
      messages: [
        { role: 'system', content: agent.systemPrompt },
        { role: 'user', content: taskPrompt },
      ],
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
    });

    const response = await Promise.race([apiPromise, timeoutPromise]) as any;

    const output = response.choices?.[0]?.message?.content || 'No response generated';
    const tokensUsed = response.usage?.totalTokens || 0;
    const confidence = this.extractConfidenceFromResponse(output);

    return { output, confidence, tokensUsed };
  }

  /**
   * Build specialized prompt for agent task
   */
  private buildTaskPrompt(agent: Agent, task: AgentTask): string {
    const basePrompt = `Task: ${JSON.stringify(task.input)}

Please execute your specialized task with the highest quality and accuracy.`;

    switch (task.taskType) {
      case 'search':
        return `${basePrompt}

As a search specialist, find and retrieve the most relevant information for this query. Focus on:
- Recent and authoritative sources
- Comprehensive coverage of the topic
- Evidence-based information
- Clear source citations

Provide your findings with confidence scores and source evaluation.`;

      case 'analyze':
        return `${basePrompt}

As a data analyst, analyze the available information and extract key insights. Focus on:
- Pattern identification and trends
- Statistical significance
- Business impact assessment
- Actionable recommendations

Support your analysis with data and logical reasoning.`;

      case 'synthesize':
        return `${basePrompt}

As a knowledge synthesizer, combine information from multiple sources into coherent insights. Focus on:
- Identifying common themes and patterns
- Resolving conflicts between sources
- Creating comprehensive summaries
- Prioritizing actionable insights

Ensure the synthesized information is consistent and valuable.`;

      case 'validate':
        return `${basePrompt}

As a validation specialist, verify the accuracy and reliability of the provided information. Focus on:
- Cross-referencing with reliable sources
- Identifying inconsistencies or errors
- Assessing information quality
- Providing confidence scores

Be thorough and critical in your validation process.`;

      default:
        return basePrompt;
    }
  }

  /**
   * Extract confidence from agent response
   */
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
