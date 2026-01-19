import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { EmbeddingsService } from './embeddings.service';
import { OpenRouter } from '@openrouter/sdk';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly openRouter: OpenRouter;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly embeddingsService: EmbeddingsService,
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
   * Send a message and get AI response with RAG context
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
  }> {
    try {
      const client = this.supabaseService.getClient();

      // Save user message
      await client.from('ai_chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: message,
      });

      // Search for relevant context using RAG
      const contextResults = await this.embeddingsService.searchSimilarDocuments(
        message,
        agencyId,
        3,
      );

      // Prepare context for the AI
      const context = contextResults
        .filter((result) => result.similarity > 0.7) // Only highly relevant results
        .map((result) => `[${result.document_title}] ${result.chunk_content}`)
        .join('\n\n');

      // Prepare the prompt with context
      const systemPrompt = `You are a helpful AI assistant for a travel agency. Use the following context to provide accurate, relevant answers. If the context doesn't contain relevant information, provide a general helpful response.

Context:
${context}

Guidelines:
- Be friendly and professional
- Provide specific, actionable advice when possible
- If you use information from the context, cite the source in parentheses
- Keep responses concise but comprehensive
- If you're unsure about something, admit it rather than guessing`;

      // Get AI response
      const response = await this.openRouter.chat.send({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
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

      // Convert sources to expected format
      const sources = contextResults.slice(0, 3).map((result) => ({
        document_id: result.document_id,
        content: result.chunk_content,
        similarity: result.similarity,
        title: result.document_title,
        category: result.document_category,
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
        },
      });

      // Update session stats (manual calculation since sql helper doesn't exist)
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
        service_type: 'chat',
        model_used: model,
        tokens_used: tokensUsed,
        cost_usd: estimatedCost,
        request_data: { message, model },
        response_data: {
          response:
            typeof aiResponse === 'string'
              ? aiResponse.substring(0, 500)
              : JSON.stringify(aiResponse).substring(0, 500),
        },
      });

      return {
        response: typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse),
        sources,
        tokens_used: tokensUsed,
        cost: estimatedCost,
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

      const { data, error } = await client
        .from('ai_chat_sessions')
        .select('id, session_name, created_at, total_tokens, total_cost')
        .eq('user_id', userId)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
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
}
