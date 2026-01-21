import { Injectable, Logger } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import {
  ContextAssemblerService,
  QueryContext,
  ContextChunk,
  OptimizedContext,
} from '../context-manager/context-assembler.service';
import {
  MemoryManagerService,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
} from '../context-manager/memory-manager.service';
import { ContextOptimizerService } from '../context-manager/context-optimizer.service';
import { PiiService } from '../security/pii.service';

import { EmbeddingsService } from './embeddings.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openRouter: OpenRouter;

  constructor(
    private readonly supabaseService: SupabaseService,
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
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('ai_chat_sessions')
        .insert({
          user_id: userId,
          agency_id: agencyId,
          session_name: sessionName,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      this.logger.log(`Created chat session ${data.id} for user ${userId}`);
      return data.id;
    } catch (error) {
      this.logger.error('Error creating chat session:', error);
      throw new Error('Failed to create chat session');
    }
  }

  /**
   * Send a message and get AI response with Advanced Context Management
   */
  async sendMessage(
    sessionId: string,
    userId: string,
    agencyId: string,
    message: string,
    model: string = 'openai/gpt-4o',
  ): Promise<{
    response: string;
    sources: Array<{
      document_id: string;
      content: string;
      similarity: number;
      title: string;
      category: string;
    }>;
    tokens_used: number;
    cost: number;
    context_metadata: {
      total_chunks: number;
      compression_ratio: number;
      relevance_score: number;
      strategies_used: string[];
    };
  }> {
    try {
      // 🛡️ SECURITY: Scrub PII from user message before processing
      const safeMessage = this.piiService.scrub(message);
      if (safeMessage !== message) {
        this.logger.warn(`PII detected and scrubbed from user message in session ${sessionId}`);
      }

      const client = this.supabaseService.getClient();

      // Save user message (Safe version)
      await client.from('ai_chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: safeMessage,
      });

      // 🧠 PHASE 1: Get conversation history for context
      const conversationHistory = await this.getConversationHistory(sessionId);

      // 🧠 PHASE 2: Search for relevant documents using embeddings
      const rawContextResults = await this.embeddingsService.searchSimilarDocuments(
        safeMessage, // Use safe message for search
        agencyId,
        20, // Get more results for better context selection
      );

      // 🧠 PHASE 3: Convert to ContextChunks for advanced processing
      const contextChunks: ContextChunk[] = rawContextResults.map((result) => ({
        id: result.document_id,
        content: result.chunk_content,
        source: result.document_category || 'unknown',
        relevanceScore: result.similarity,
        tokenCount: this.estimateTokenCount(result.chunk_content),
        timestamp: new Date(Date.now()),
        metadata: {
          document_title: result.document_title,
          document_category: result.document_category,
          similarity: result.similarity,
        },
      }));

      // 🧠 PHASE 4: Query memory systems for additional context
      const episodicMemories = await this.memoryManager.queryMemories({
        type: 'episodic',
        query: safeMessage,
        userId,
        agencyId,
        sessionId,
        limit: 5,
      });

      const semanticMemories = await this.memoryManager.queryMemories({
        type: 'semantic',
        query: safeMessage,
        userId,
        agencyId,
        limit: 3,
      });

      const proceduralMemories = await this.memoryManager.queryMemories({
        type: 'procedural',
        query: safeMessage,
        userId,
        agencyId,
        limit: 2,
      });

      // 🧠 PHASE 5: Convert memories to context chunks
      const memoryChunks: ContextChunk[] = [];

      // Add episodic memories
      for (const mem of episodicMemories) {
        if ('content' in mem.content && 'timestamp' in mem.content && 'outcome' in mem.content) {
          memoryChunks.push({
            id: `episodic-${mem.content.id}`,
            content: mem.content.content,
            source: 'episodic_memory',
            relevanceScore: mem.relevanceScore,
            tokenCount: this.estimateTokenCount(mem.content.content),
            timestamp: new Date(mem.content.timestamp),
            metadata: { type: 'episodic', outcome: mem.content.outcome },
          });
        }
      }

      // Add semantic memories
      for (const mem of semanticMemories) {
        if ('facts' in mem.content && 'lastUpdated' in mem.content && 'confidence' in mem.content) {
          memoryChunks.push({
            id: `semantic-${mem.content.id}`,
            content: Array.isArray(mem.content.facts)
              ? mem.content.facts.join('. ')
              : String(mem.content.facts),
            source: 'semantic_memory',
            relevanceScore: mem.relevanceScore,
            tokenCount: this.estimateTokenCount(
              Array.isArray(mem.content.facts)
                ? mem.content.facts.join('. ')
                : String(mem.content.facts),
            ),
            timestamp: new Date(mem.content.lastUpdated),
            metadata: { type: 'semantic', confidence: mem.content.confidence },
          });
        }
      }

      // Add procedural memories
      for (const mem of proceduralMemories) {
        if (
          'pattern' in mem.content &&
          'steps' in mem.content &&
          'lastUsed' in mem.content &&
          'successRate' in mem.content
        ) {
          memoryChunks.push({
            id: `procedural-${mem.content.id}`,
            content: `${mem.content.pattern}: ${Array.isArray(mem.content.steps) ? mem.content.steps.join(' -> ') : String(mem.content.steps)}`,
            source: 'procedural_memory',
            relevanceScore: mem.relevanceScore,
            tokenCount: this.estimateTokenCount(
              Array.isArray(mem.content.steps)
                ? mem.content.steps.join(' ')
                : String(mem.content.steps),
            ),
            timestamp: new Date(mem.content.lastUsed),
            metadata: { type: 'procedural', successRate: mem.content.successRate },
          });
        }
      }

      // 🧠 PHASE 6: Combine all context sources
      const allChunks = [...contextChunks, ...memoryChunks];

      // 🧠 PHASE 7: Create query context
      const queryContext: QueryContext = {
        query: safeMessage,
        userId,
        sessionId,
        conversationHistory: conversationHistory.map((h) => ({
          role: h.role as 'user' | 'assistant',
          content: h.content,
          timestamp: new Date(h.created_at),
        })),
        domain: 'hotel_crm', // HOTELCRM specific domain
        urgency: this.determineUrgency(safeMessage),
      };

      // 🧠 PHASE 8: Assemble optimized context
      const optimizedContext: OptimizedContext = await this.contextAssembler.assembleContext(
        allChunks,
        queryContext,
        {
          maxTokens: 6000, // Conservative limit for most models
          targetTokens: 4000,
          minTokens: 1000,
        },
      );

      // 🧠 PHASE 9: Apply additional optimization if needed
      const finalContext = await this.contextOptimizer.optimizeContext(
        optimizedContext.chunks,
        3500, // Final token budget
      );

      // 🧠 PHASE 10: Build system prompt with optimized context
      const systemPrompt = this.buildSystemPrompt(finalContext, queryContext);

      // Get AI response with optimized context
      const response = await this.openRouter.chat.send({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: safeMessage },
        ],
        model: model,
        stream: false,
      });

      const aiResponse =
        response.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
      const tokensUsed = response.usage?.totalTokens || 0;

      // Calculate approximate cost (rough estimate)
      const costPerToken = 0.000001; // Adjust based on actual pricing
      const estimatedCost = tokensUsed * costPerToken;

      // Convert aiResponse to string for storage
      const aiResponseStr =
        typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse);

      // 🧠 PHASE 11: Store interaction in episodic memory
      await this.memoryManager.storeEpisodicMemory({
        userId,
        agencyId,
        sessionId,
        interactionType: 'conversation',
        content: `User: ${safeMessage}\nAssistant: ${aiResponseStr}`,
        context: {
          model,
          tokensUsed,
          contextChunks: finalContext.chunks.length,
          compressionRatio: finalContext.compressionRatio,
        },
        outcome: 'success',
        importance: this.calculateInteractionImportance(safeMessage, aiResponseStr),
        timestamp: new Date(),
      });

      // 🧠 PHASE 12: Update semantic memory with new knowledge
      await this.updateSemanticMemory(safeMessage, aiResponseStr, agencyId);

      // Convert sources to expected format
      const sources = finalContext.chunks.slice(0, 5).map((chunk) => ({
        document_id: chunk.id,
        content: chunk.content,
        similarity: chunk.relevanceScore,
        title: chunk.metadata?.document_title || chunk.source,
        category: chunk.source,
      }));

      // Save AI response
      await client.from('ai_chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse),
        tokens_used: tokensUsed,
        model_used: model,
        metadata: {
          sources,
          cost: estimatedCost,
          contextMetadata: {
            totalChunks: finalContext.chunks.length,
            compressionRatio: finalContext.compressionRatio,
            relevanceScore: finalContext.relevanceScore,
            strategiesUsed: finalContext.metadata.strategiesUsed,
          },
        },
      });

      // Update session stats
      const { data: currentSession } = await client
        .from('ai_chat_sessions')
        .select('total_tokens, total_cost')
        .eq('id', sessionId)
        .single();

      if (currentSession) {
        await client
          .from('ai_chat_sessions')
          .update({
            total_tokens: (currentSession.total_tokens || 0) + tokensUsed,
            total_cost: (currentSession.total_cost || 0) + estimatedCost,
          })
          .eq('id', sessionId);
      }

      // Log usage
      await client.from('ai_usage_logs').insert({
        agency_id: agencyId,
        user_id: userId,
        service_type: 'chat_advanced',
        model_used: model,
        tokens_used: tokensUsed,
        cost_usd: estimatedCost,
        request_data: { message: safeMessage, model, contextOptimization: true },
        response_data: {
          response:
            typeof aiResponse === 'string'
              ? aiResponse.substring(0, 500)
              : JSON.stringify(aiResponse).substring(0, 500),
          contextStats: {
            chunksUsed: finalContext.chunks.length,
            compressionRatio: finalContext.compressionRatio,
            relevanceScore: finalContext.relevanceScore,
          },
        },
      });

      return {
        response: typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse),
        sources,
        tokens_used: tokensUsed,
        cost: estimatedCost,
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

  /**
   * Get chat session history
   */
  async getSessionHistory(
    sessionId: string,
    userId: string,
  ): Promise<
    Array<{
      id: string;
      role: string;
      content: string;
      created_at: string;
      tokens_used?: number;
      metadata?: any;
    }>
  > {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('ai_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error getting session history:', error);
      throw new Error('Failed to get session history');
    }
  }

  /**
   * Get user's chat sessions
   */
  async getUserSessions(
    userId: string,
    agencyId: string,
  ): Promise<
    Array<{
      id: string;
      session_name?: string;
      created_at: string;
      total_tokens: number;
      total_cost: number;
    }>
  > {
    try {
      const client = this.supabaseService.getClient();

      // 🔧 OPTIMIZATION: Select only needed fields to prevent over-fetching
      const { data, error } = await client
        .from('ai_chat_sessions')
        .select('id, session_name, created_at, total_tokens, total_cost') // Only needed fields
        .eq('user_id', userId)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map((session: any) => ({
        id: session.id,
        session_name: session.session_name,
        created_at: session.created_at,
        total_tokens: session.total_tokens || 0,
        total_cost: session.total_cost || 0,
      }));
    } catch (error) {
      this.logger.error('Error getting user sessions:', error);
      throw new Error('Failed to get user sessions');
    }
  }

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      // Delete messages first (cascade will handle this, but being explicit)
      await client.from('ai_chat_messages').delete().eq('session_id', sessionId);

      // Delete session
      const { error } = await client
        .from('ai_chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      this.logger.log(`Deleted chat session ${sessionId}`);
    } catch (error) {
      this.logger.error('Error deleting session:', error);
      throw new Error('Failed to delete session');
    }
  }

  /**
   * Generate AI recommendations based on agency data
   */
  async generateRecommendations(
    agencyId: string,
    userId: string,
  ): Promise<
    Array<{
      type: string;
      title: string;
      description: string;
      confidence_score: number;
    }>
  > {
    try {
      const client = this.supabaseService.getClient();

      // Get agency stats for recommendations
      const { data: stats } = await client
        .from('bookings')
        .select('total_amount, created_at, status')
        .eq('agency_id', agencyId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Simple recommendation logic (can be enhanced with ML)
      const recommendations = [];

      if (stats && stats.length > 0) {
        const totalRevenue = stats.reduce((sum, booking) => sum + booking.total_amount, 0);
        const completedBookings = stats.filter((b) => b.status === 'completed').length;

        if (totalRevenue > 50000) {
          recommendations.push({
            type: 'revenue_optimization',
            title: 'Oportunidad de expansión',
            description:
              'Tu agencia ha tenido un excelente rendimiento este mes. Considera expandir tus servicios premium.',
            confidence_score: 0.85,
          });
        }

        if (completedBookings < stats.length * 0.8) {
          recommendations.push({
            type: 'booking_optimization',
            title: 'Mejorar conversión de reservas',
            description:
              'Algunas reservas no se completaron. Revisa el proceso de confirmación y seguimiento.',
            confidence_score: 0.75,
          });
        }
      }

      // Save recommendations
      if (recommendations.length > 0) {
        await client.from('ai_recommendations').insert(
          recommendations.map((rec) => ({
            agency_id: agencyId,
            user_id: userId,
            recommendation_type: rec.type,
            title: rec.title,
            description: rec.description,
            confidence_score: rec.confidence_score,
          })),
        );
      }

      return recommendations;
    } catch (error) {
      this.logger.error('Error generating recommendations:', error);
      throw new Error('Failed to generate recommendations');
    }
  }

  // Helper methods for Advanced Context Management

  /**
   * Get conversation history for context
   */
  private async getConversationHistory(sessionId: string): Promise<any[]> {
    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('ai_chat_messages')
        .select('role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(10); // Last 10 messages for context

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logger.warn('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Estimate token count for content
   */
  private estimateTokenCount(content: string): number {
    // Rough approximation: ~4 characters per token for English text
    return Math.ceil(content.length / 4);
  }

  /**
   * Determine urgency level from message
   */
  private determineUrgency(message: string): 'low' | 'medium' | 'high' | 'critical' {
    const lowerMessage = message.toLowerCase();

    // Critical keywords
    if (
      lowerMessage.includes('emergency') ||
      lowerMessage.includes('urgent') ||
      lowerMessage.includes('critical') ||
      lowerMessage.includes('asap')
    ) {
      return 'critical';
    }

    // High priority
    if (
      lowerMessage.includes('important') ||
      lowerMessage.includes('deadline') ||
      lowerMessage.includes('immediately') ||
      lowerMessage.includes('today')
    ) {
      return 'high';
    }

    // Medium priority
    if (
      lowerMessage.includes('soon') ||
      lowerMessage.includes('quick') ||
      lowerMessage.includes('fast')
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Build optimized system prompt
   */
  private buildSystemPrompt(context: OptimizedContext, queryContext: QueryContext): string {
    const contextText = context.chunks
      .map((chunk) => `[${chunk.metadata?.document_title || chunk.source}] ${chunk.content}`)
      .join('\n\n');

    return `You are an advanced AI assistant for HOTELCRM, a comprehensive hotel management system.

CONTEXT INFORMATION (Optimized for relevance - ${Math.round(context.compressionRatio * 100)}% compression ratio):
${contextText}

SYSTEM CAPABILITIES:
- Hotel booking and reservation management
- Customer relationship management
- Payment processing with Stripe
- Real-time analytics and reporting
- AI-powered recommendations
- Multi-agency support with data isolation

RESPONSE GUIDELINES:
- Provide specific, actionable advice using the context provided
- Be friendly and professional
- Cite sources when using specific information
- Keep responses concise but comprehensive
- If you don't have relevant information, acknowledge it and provide general guidance
- Focus on HOTELCRM features and best practices

Current domain: ${queryContext.domain || 'general'}
Urgency level: ${queryContext.urgency || 'normal'}`;
  }

  /**
   * Calculate interaction importance for memory storage
   */
  private calculateInteractionImportance(message: string, response: string): number {
    let importance = 0.5; // Base importance

    // High importance keywords
    const highImportanceKeywords = [
      'error',
      'problem',
      'issue',
      'bug',
      'fail',
      'crash',
      'emergency',
      'security',
      'payment',
      'booking',
      'reservation',
      'cancel',
      'refund',
      'complaint',
      'urgent',
      'critical',
    ];

    const combinedText = (message + response).toLowerCase();
    for (const keyword of highImportanceKeywords) {
      if (combinedText.includes(keyword)) {
        importance += 0.2;
      }
    }

    // Length-based importance (longer conversations tend to be more important)
    if (combinedText.length > 500) importance += 0.1;
    if (combinedText.length > 1000) importance += 0.1;

    return Math.min(1.0, importance);
  }

  /**
   * Update semantic memory with new knowledge from conversation
   */
  private async updateSemanticMemory(
    message: string,
    response: string,
    agencyId: string,
  ): Promise<void> {
    try {
      // Extract key concepts from the conversation
      const concepts = this.extractConcepts(message, response);

      for (const concept of concepts) {
        await this.memoryManager.storeSemanticMemory({
          agencyId,
          concept: concept.name,
          category: concept.category,
          facts: [concept.fact],
          relationships: concept.relationships,
          confidence: concept.confidence,
          source: 'conversation_extraction',
        });
      }
    } catch (error) {
      this.logger.warn('Error updating semantic memory:', error);
      // Don't throw - memory updates are not critical
    }
  }

  /**
   * Extract concepts from conversation for semantic memory
   */
  private extractConcepts(
    message: string,
    response: string,
  ): Array<{
    name: string;
    category: string;
    fact: string;
    relationships: Array<{ relatedConcept: string; relationshipType: string; strength: number }>;
    confidence: number;
  }> {
    const concepts: Array<{
      name: string;
      category: string;
      fact: string;
      relationships: Array<{ relatedConcept: string; relationshipType: string; strength: number }>;
      confidence: number;
    }> = [];

    const combinedText = (message + ' ' + response).toLowerCase();

    // Extract booking-related concepts
    if (combinedText.includes('booking') || combinedText.includes('reservation')) {
      concepts.push({
        name: 'Hotel Booking Process',
        category: 'business_process',
        fact: 'Hotel bookings involve check-in/check-out dates, guest information, and payment processing',
        relationships: [
          { relatedConcept: 'Payment Processing', relationshipType: 'requires', strength: 0.8 },
          { relatedConcept: 'Guest Management', relationshipType: 'involves', strength: 0.9 },
        ],
        confidence: 0.8,
      });
    }

    // Extract payment-related concepts
    if (combinedText.includes('payment') || combinedText.includes('stripe')) {
      concepts.push({
        name: 'Payment Processing',
        category: 'technical_process',
        fact: 'Payments are processed through Stripe with support for multiple currencies',
        relationships: [
          { relatedConcept: 'Stripe Integration', relationshipType: 'uses', strength: 0.9 },
          { relatedConcept: 'Hotel Booking Process', relationshipType: 'supports', strength: 0.8 },
        ],
        confidence: 0.9,
      });
    }

    return concepts;
  }
}
