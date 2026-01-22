import { Injectable, Logger } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';
import {
  ContextChunk,
  OptimizedContext,
  QueryContext,
  ChatSession,
  ChatMessage,
  ConversationOptions,
  AiRecommendation,
} from '@hotel-crm/shared';

import { ContextAssemblerService } from '../context-manager/context-assembler.service';
import { MemoryManagerService } from '../context-manager/memory-manager.service';
import { ContextOptimizerService } from '../context-manager/context-optimizer.service';
import { PiiService } from '../security/pii.service';

import { EmbeddingsService } from './embeddings.service';
import { ChatRepositoryPort } from './domain/ports/chat-repository.port';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openRouter: OpenRouter;

  constructor(
    private readonly chatRepository: ChatRepositoryPort,
    private readonly embeddingsService: EmbeddingsService,
    private readonly contextAssembler: ContextAssemblerService,
    private readonly memoryManager: MemoryManagerService,
    private readonly contextOptimizer: ContextOptimizerService,
    private readonly piiService: PiiService,
  ) {
    this.openRouter = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  /**
   * Create a new chat session
   */
  async createSession(userId: string, agencyId: string, sessionName?: string): Promise<string> {
    try {
      const session = await this.chatRepository.create({
        userId,
        agencyId,
        title: sessionName,
        status: 'active',
        metadata: {},
      });

      this.logger.log(`Created chat session ${session.id} for user ${userId}`);
      return session.id;
    } catch (error) {
      this.logger.error('Error creating chat session:', error);
      throw new Error('Failed to create chat session');
    }
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    sessionId: string,
    userId: string,
    agencyId: string,
    message: string,
    model: string = 'openai/gpt-4o',
  ) {
    try {
      const safeMessage = this.piiService.scrub(message);

      // Save user message
      await this.chatRepository.saveMessage(sessionId, {
        sessionId,
        role: 'user',
        content: safeMessage,
        metadata: {},
      });

      // 🧠 PHASE 1: Context & Memories
      const conversationHistory = await this.chatRepository.getConversationHistory(sessionId, { limit: 10 });
      const rawContextResults = await this.embeddingsService.searchSimilarDocuments(safeMessage, agencyId, 20);

      const contextChunks: ContextChunk[] = rawContextResults.map((result) => ({
        id: result.document_id,
        content: result.chunk_content,
        source: result.document_category || 'unknown',
        relevanceScore: result.similarity,
        tokenCount: this.estimateTokenCount(result.chunk_content),
        timestamp: new Date(),
        metadata: {
          document_title: result.document_title,
          document_category: result.document_category,
        },
      }));

      const episodicMemories = await this.memoryManager.queryMemories({
        type: 'episodic', query: safeMessage, userId, agencyId, sessionId, limit: 5,
      });

      const memoryChunks: ContextChunk[] = episodicMemories.map(mem => {
        const content = mem.content as any;
        return {
          id: `episodic-${content.id}`,
          content: content.content,
          source: 'episodic_memory',
          relevanceScore: mem.relevanceScore,
          tokenCount: this.estimateTokenCount(content.content),
          timestamp: content.createdAt,
          metadata: { type: 'episodic' },
        };
      });

      const allChunks = [...contextChunks, ...memoryChunks];

      const queryContext: QueryContext = {
        query: safeMessage,
        userId,
        sessionId,
        conversationHistory: conversationHistory.map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
          timestamp: h.createdAt,
        })),
        domain: 'hotel_crm',
        urgency: this.determineUrgency(safeMessage),
      };

      const optimizedContext: OptimizedContext = await this.contextAssembler.assembleContext(
        allChunks, queryContext, { maxTokens: 6000, targetTokens: 4000, minTokens: 1000 },
      );

      const finalContext = await this.contextOptimizer.optimizeContext(optimizedContext.chunks, 3500);
      const systemPrompt = this.buildSystemPrompt(finalContext, queryContext);

      const response = await this.openRouter.chat.send({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: safeMessage }],
        model: model,
        stream: false,
      });

      const aiResponseRaw = response.choices[0]?.message?.content || 'Lo siento...';
      const aiResponse = typeof aiResponseRaw === 'string' ? aiResponseRaw : JSON.stringify(aiResponseRaw);
      
      const tokensUsed = response.usage?.totalTokens || 0;
      const estimatedCost = tokensUsed * 0.000001;

      // 🧠 PHASE 11: Persist results through repository
      await this.memoryManager.storeEpisodicMemory({
        userId, agencyId, sessionId, interactionType: 'conversation',
        content: `User: ${safeMessage}\nAssistant: ${aiResponse}`,
        context: { model, tokensUsed }, outcome: 'success',
        importance: this.calculateInteractionImportance(safeMessage, aiResponse),
      });

      const sources = finalContext.chunks.slice(0, 5).map((chunk: ContextChunk) => ({
        document_id: chunk.id, content: chunk.content, similarity: chunk.relevanceScore,
        title: chunk.metadata?.document_title || chunk.source, category: chunk.source,
      }));

      await this.chatRepository.saveMessage(sessionId, {
        sessionId, role: 'assistant', content: aiResponse,
        tokens: tokensUsed, metadata: { sources, cost: estimatedCost },
      });

      await this.chatRepository.updateSessionStats(sessionId, tokensUsed, estimatedCost);

      await this.chatRepository.logUsage({
        agencyId, userId, serviceType: 'chat_advanced', modelUsed: model,
        tokensUsed, costUsd: estimatedCost,
        requestData: { message: safeMessage, model },
        responseData: { response: aiResponse.substring(0, 500) },
      });

      return {
        response: aiResponse, sources, tokens_used: tokensUsed, cost: estimatedCost,
        context_metadata: {
          total_chunks: finalContext.chunks.length,
          compression_ratio: finalContext.compressionRatio,
          relevance_score: finalContext.relevanceScore,
          strategies_used: finalContext.metadata.strategiesUsed,
        },
      };
    } catch (error) {
      this.logger.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }

  async getSessionHistory(sessionId: string, userId: string) {
    const history = await this.chatRepository.getConversationHistory(sessionId);
    return history.map(msg => ({
      id: msg.id, role: msg.role, content: msg.content,
      created_at: msg.createdAt.toISOString(),
      tokens_used: msg.tokens, metadata: msg.metadata
    }));
  }

  async getUserSessions(userId: string, agencyId: string) {
    const sessions = await this.chatRepository.findByUserId(userId);
    return sessions.map(s => ({
      id: s.id, session_name: s.title, created_at: s.createdAt.toISOString(),
      total_tokens: (s.metadata as any).total_tokens || 0,
      total_cost: (s.metadata as any).total_cost || 0
    }));
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await this.chatRepository.delete(sessionId);
  }

  async generateRecommendations(agencyId: string, userId: string): Promise<AiRecommendation[]> {
    // Simplified logic for now, using repository
    const recommendation: Omit<AiRecommendation, 'id' | 'createdAt' | 'updatedAt'> = {
      agencyId,
      userId,
      recommendationType: 'business_optimization',
      title: 'Optimización de Reservas',
      description: 'Basado en los datos actuales, podrías mejorar la conversión...',
      confidenceScore: 0.85,
      metadata: {},
    };

    await this.chatRepository.saveRecommendation(recommendation);
    return [recommendation as AiRecommendation];
  }

  private estimateTokenCount(content: string): number {
    return Math.ceil(content.length / 4);
  }

  private determineUrgency(message: string): 'low' | 'medium' | 'high' | 'critical' {
    const lower = message.toLowerCase();
    if (lower.includes('urgent') || lower.includes('critical')) return 'critical';
    if (lower.includes('important')) return 'high';
    return 'low';
  }

  private buildSystemPrompt(context: OptimizedContext, queryContext: QueryContext): string {
    const contextText = context.chunks
      .map((chunk: ContextChunk) => `[${chunk.metadata?.document_title || chunk.source}] ${chunk.content}`)
      .join('\n\n');
    return `You are an advanced AI assistant for HOTELCRM...\n\nCONTEXT:\n${contextText}`;
  }

  private calculateInteractionImportance(message: string, response: string): number {
    return 0.5;
  }
}
