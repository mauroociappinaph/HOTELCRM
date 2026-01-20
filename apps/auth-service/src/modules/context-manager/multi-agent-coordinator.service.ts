import { Injectable, Logger } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { ContextAssemblerService, QueryContext } from './context-assembler.service';

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
  context?: QueryContext;
  dependencies?: string[]; // Task IDs this task depends on
  timeout: number; // milliseconds
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
  executionOrder: string[][]; // Parallel groups of tasks
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
  fallbackStrategies: string[];
}

@Injectable()
export class MultiAgentCoordinatorService {
  private readonly logger = new Logger(MultiAgentCoordinatorService.name);
  private readonly openRouter: OpenRouter;

  // Agent Registry
  private agents: Map<string, Agent> = new Map();
  private activeTasks: Map<string, AgentTask> = new Map();
  private taskResults: Map<string, TaskResult> = new Map();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly contextAssembler: ContextAssemblerService,
  ) {
    this.openRouter = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    this.initializeAgents();
  }

  /**
   * Initialize specialized agents
   */
  private initializeAgents(): void {
    // Search Agent - Specialized in information retrieval
    this.registerAgent({
      id: 'search-agent',
      name: 'Search Specialist',
      role: 'Information Retrieval Expert',
      specialty: 'Web search, document search, and knowledge discovery',
      capabilities: ['web_search', 'document_retrieval', 'knowledge_discovery', 'source_evaluation'],
      model: 'openai/gpt-4o',
      temperature: 0.1,
      maxTokens: 2000,
      systemPrompt: `You are a specialized search agent for HOTELCRM. Your expertise is finding, evaluating, and retrieving relevant information efficiently.

CAPABILITIES:
- Web search and information gathering
- Document and knowledge base retrieval
- Source credibility assessment
- Relevance filtering and ranking

APPROACH:
- Be thorough but concise in searches
- Prioritize recent and authoritative sources
- Provide evidence-based recommendations
- Structure results for easy consumption

Always provide sources and confidence levels for your findings.`,
      isActive: true,
    });

    // Analysis Agent - Specialized in data analysis and insights
    this.registerAgent({
      id: 'analysis-agent',
      name: 'Data Analyst',
      role: 'Business Intelligence Specialist',
      specialty: 'Data analysis, pattern recognition, and business insights',
      capabilities: ['data_analysis', 'pattern_recognition', 'trend_identification', 'business_intelligence'],
      model: 'openai/gpt-4o',
      temperature: 0.2,
      maxTokens: 3000,
      systemPrompt: `You are a specialized analysis agent for HOTELCRM. Your expertise is analyzing data, identifying patterns, and generating actionable business insights.

CAPABILITIES:
- Statistical analysis and interpretation
- Trend identification and forecasting
- Performance metrics analysis
- Business intelligence and recommendations

APPROACH:
- Use data-driven reasoning
- Identify key patterns and anomalies
- Provide actionable recommendations
- Support conclusions with evidence

Focus on HOTELCRM business metrics: bookings, revenue, customer satisfaction, operational efficiency.`,
      isActive: true,
    });

    // Synthesis Agent - Specialized in combining information
    this.registerAgent({
      id: 'synthesis-agent',
      name: 'Knowledge Synthesizer',
      role: 'Information Integration Expert',
      specialty: 'Combining multiple sources of information into coherent insights',
      capabilities: ['information_synthesis', 'knowledge_integration', 'conflict_resolution', 'summary_generation'],
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 4000,
      systemPrompt: `You are a specialized synthesis agent for HOTELCRM. Your expertise is combining information from multiple sources into coherent, actionable insights.

CAPABILITIES:
- Information integration and synthesis
- Conflict resolution between sources
- Executive summary generation
- Recommendation consolidation

APPROACH:
- Identify common themes across sources
- Resolve contradictions with evidence
- Create comprehensive yet concise summaries
- Prioritize actionable insights

Ensure synthesized information is consistent, accurate, and valuable for HOTELCRM decision-making.`,
      isActive: true,
    });

    // Validation Agent - Specialized in quality assurance
    this.registerAgent({
      id: 'validation-agent',
      name: 'Quality Assurance Specialist',
      role: 'Validation and Quality Control Expert',
      specialty: 'Validating information accuracy, consistency, and reliability',
      capabilities: ['fact_checking', 'consistency_validation', 'quality_assessment', 'error_detection'],
      model: 'openai/gpt-4o',
      temperature: 0.1,
      maxTokens: 1500,
      systemPrompt: `You are a specialized validation agent for HOTELCRM. Your expertise is ensuring information quality, accuracy, and reliability.

CAPABILITIES:
- Fact-checking and verification
- Consistency validation across sources
- Quality assessment and scoring
- Error detection and correction

APPROACH:
- Cross-reference information with reliable sources
- Identify inconsistencies and potential errors
- Provide confidence scores for information
- Suggest corrections when needed

Be thorough and critical in your validation process, ensuring only high-quality information reaches HOTELCRM users.`,
      isActive: true,
    });

    this.logger.log(`✅ Initialized ${this.agents.size} specialized agents`);
  }

  /**
   * Register a new agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.logger.log(`Registered agent: ${agent.name} (${agent.role})`);
  }

  /**
   * Coordinate multi-agent task execution
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
      const finalAnswer = await this.synthesizeFinalAnswer(results, mainTask, context);
      const confidence = this.calculateOverallConfidence(results);

      const processingTime = Date.now() - startTime;

      // Store coordination results
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
   * Create a coordination plan for complex tasks
   */
  private async createCoordinationPlan(
    mainTask: string,
    context: QueryContext,
    options: any
  ): Promise<CoordinationPlan> {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Analyze task complexity and determine required agents
    const taskAnalysis = await this.analyzeTaskComplexity(mainTask, context);
    const subtasks = await this.decomposeTask(mainTask, taskAnalysis, context);

    // Determine execution order with dependencies
    const executionOrder = this.calculateExecutionOrder(subtasks);

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
   * Execute coordination plan
   */
  private async executeCoordinationPlan(
    plan: CoordinationPlan,
    options: any
  ): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const maxParallel = options.maxParallelTasks || 3;

    for (const taskGroup of plan.executionOrder) {
      // Execute tasks in parallel within each group
      const groupPromises = taskGroup.slice(0, maxParallel).map(taskId => {
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
        } else {
          // Handle task failure
          const failedTask = plan.subtasks.find(t => t.id === taskId)!;
          results.push({
            taskId,
            agentId: failedTask.agentId,
            status: 'failure',
            output: null,
            confidence: 0,
            processingTime: 0,
            tokensUsed: 0,
            error: result.reason?.message || 'Task execution failed',
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute individual agent task
   */
  private async executeAgentTask(task: AgentTask, timeout: number): Promise<TaskResult> {
    const startTime = Date.now();
    const agent = this.agents.get(task.agentId);

    if (!agent || !agent.isActive) {
      throw new Error(`Agent ${task.agentId} not available`);
    }

    this.activeTasks.set(task.id, task);

    try {
      const result = await this.callAgentAPI(agent, task, timeout);

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

      this.taskResults.set(task.id, taskResult);
      this.activeTasks.delete(task.id);

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

      this.taskResults.set(task.id, taskResult);
      this.activeTasks.delete(task.id);

      // Implement retry logic
      if (task.retryCount < task.maxRetries) {
        task.retryCount++;
        this.logger.log(`🔄 Retrying task ${task.id} (attempt ${task.retryCount}/${task.maxRetries})`);
        return this.executeAgentTask(task, timeout);
      }

      return taskResult;
    }
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

    try {
      // Note: OpenRouter doesn't support AbortController, so we use a timeout promise
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

      // Extract confidence from response (agents should include confidence scores)
      const confidence = this.extractConfidenceFromResponse(output);

      return {
        output,
        confidence,
        tokensUsed,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Analyze task complexity to determine coordination needs
   */
  private async analyzeTaskComplexity(task: string, context: QueryContext): Promise<{
    complexity: 'simple' | 'medium' | 'complex';
    requiredCapabilities: string[];
    estimatedSteps: number;
    domain: string;
  }> {
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
  private async decomposeTask(
    mainTask: string,
    analysis: any,
    context: QueryContext
  ): Promise<AgentTask[]> {
    const subtasks: AgentTask[] = [];

    switch (analysis.complexity) {
      case 'simple':
        // Single task for simple queries
        subtasks.push({
          id: `task-${Date.now()}-search`,
          agentId: 'search-agent',
          taskType: 'search',
          priority: 'medium',
          input: { query: mainTask, context },
          timeout: 15000,
          retryCount: 0,
          maxRetries: 2,
        });
        break;

      case 'medium':
        // Search + Analysis
        subtasks.push(
          {
            id: `task-${Date.now()}-search`,
            agentId: 'search-agent',
            taskType: 'search',
            priority: 'high',
            input: { query: mainTask, context },
            timeout: 20000,
            retryCount: 0,
            maxRetries: 2,
          },
          {
            id: `task-${Date.now()}-analyze`,
            agentId: 'analysis-agent',
            taskType: 'analyze',
            priority: 'medium',
            input: { query: mainTask, context },
            dependencies: [`task-${Date.now()}-search`],
            timeout: 25000,
            retryCount: 0,
            maxRetries: 2,
          }
        );
        break;

      case 'complex':
        // Full pipeline: Search → Analysis → Synthesis → Validation
        const timestamp = Date.now();
        subtasks.push(
          {
            id: `task-${timestamp}-search`,
            agentId: 'search-agent',
            taskType: 'search',
            priority: 'high',
            input: { query: mainTask, context },
            timeout: 20000,
            retryCount: 0,
            maxRetries: 2,
          },
          {
            id: `task-${timestamp}-analyze`,
            agentId: 'analysis-agent',
            taskType: 'analyze',
            priority: 'high',
            input: { query: mainTask, context },
            dependencies: [`task-${timestamp}-search`],
            timeout: 25000,
            retryCount: 0,
            maxRetries: 2,
          },
          {
            id: `task-${timestamp}-synthesize`,
            agentId: 'synthesis-agent',
            taskType: 'synthesize',
            priority: 'medium',
            input: { query: mainTask, context },
            dependencies: [`task-${timestamp}-search`, `task-${timestamp}-analyze`],
            timeout: 30000,
            retryCount: 0,
            maxRetries: 2,
          },
          {
            id: `task-${timestamp}-validate`,
            agentId: 'validation-agent',
            taskType: 'validate',
            priority: 'low',
            input: { query: mainTask, context },
            dependencies: [`task-${timestamp}-synthesize`],
            timeout: 20000,
            retryCount: 0,
            maxRetries: 2,
          }
        );
        break;
    }

    return subtasks;
  }

  /**
   * Calculate execution order considering dependencies
   */
  private calculateExecutionOrder(subtasks: AgentTask[]): string[][] {
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
   * Synthesize final answer from all task results
   */
  private async synthesizeFinalAnswer(
    results: TaskResult[],
    mainTask: string,
    context: QueryContext
  ): Promise<string> {
    const successfulResults = results.filter(r => r.status === 'success');

    if (successfulResults.length === 0) {
      return 'Lo siento, no pude completar la tarea solicitada. Todos los intentos fallaron.';
    }

    // For simple tasks, return the best result directly
    if (successfulResults.length === 1) {
      return successfulResults[0].output;
    }

    // For complex tasks, use synthesis agent to combine results
    const synthesisAgent = this.agents.get('synthesis-agent');
    if (!synthesisAgent) {
      // Fallback: return the result with highest confidence
      const bestResult = successfulResults.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
      return bestResult.output;
    }

    try {
      const synthesisTask: AgentTask = {
        id: `synthesis-${Date.now()}`,
        agentId: 'synthesis-agent',
        taskType: 'synthesize',
        priority: 'high',
        input: {
          mainTask,
          results: successfulResults.map(r => ({ agent: r.agentId, output: r.output, confidence: r.confidence })),
          context,
        },
        timeout: 30000,
        retryCount: 0,
        maxRetries: 1,
      };

      const synthesisResult = await this.executeAgentTask(synthesisTask, 30000);
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
  private calculateOverallConfidence(results: TaskResult[]): number {
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
      const task = this.activeTasks.get(result.taskId);
      const taskType = task?.taskType || 'search';
      const weight = weights[taskType] || 0.25;

      weightedSum += result.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
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

  // Helper methods

  private estimateExecutionTime(subtasks: AgentTask[]): number {
    return subtasks.reduce((total, task) => {
      const agent = this.agents.get(task.agentId);
      const baseTime = agent ? 10000 : 15000; // Base time per agent type
      return total + baseTime + (task.timeout * 0.1); // Add buffer
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
    // Extract confidence score from agent response
    const confidenceMatch = response.match(/confidence:?\s*(\d+(?:\.\d+)?)/i);
    if (confidenceMatch) {
      return Math.min(1.0, Math.max(0.0, parseFloat(confidenceMatch[1])));
    }

    // Fallback: estimate based on response length and assertiveness
    const hasUncertainWords = /\b(maybe|perhaps|possibly|might|could|unsure)\b/i.test(response);
    const hasCertainWords = /\b(definitely|certainly|clearly|obviously|definite)\b/i.test(response);

    let confidence = 0.7; // Base confidence

    if (hasUncertainWords) confidence -= 0.2;
    if (hasCertainWords) confidence += 0.1;

    return Math.min(1.0, Math.max(0.3, confidence));
  }

  /**
   * Get coordination statistics
   */
  async getCoordinationStats(): Promise<{
    totalCoordinations: number;
    averageConfidence: number;
    averageProcessingTime: number;
    successRate: number;
    agentPerformance: Record<string, { tasks: number; avgConfidence: number }>;
  }> {
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

      // Calculate agent performance
      const agentPerformance: Record<string, { tasks: number; avgConfidence: number }> = {};

      for (const coordination of data) {
        for (const result of coordination.results) {
          if (!agentPerformance[result.agentId]) {
            agentPerformance[result.agentId] = { tasks: 0, avgConfidence: 0 };
          }
          agentPerformance[result.agentId].tasks++;
          agentPerformance[result.agentId].avgConfidence += result.confidence;
        }
      }

      // Average the confidence scores
      for (const agentId in agentPerformance) {
        const agent = agentPerformance[agentId];
        agent.avgConfidence = agent.avgConfidence / agent.tasks;
      }

      return {
        totalCoordinations,
        averageConfidence,
        averageProcessingTime,
        successRate,
        agentPerformance,
      };
    } catch (error) {
      this.logger.error('Error getting coordination stats:', error);
      throw error;
    }
  }
}
