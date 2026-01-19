import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ChatService } from './chat.service';
import { EmbeddingsService } from './embeddings.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('ai')
@UseGuards(SupabaseAuthGuard)
export class AiController {
  constructor(
    private readonly chatService: ChatService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  @Post('chat/session')
  async createSession(@Request() req: any, @Body() body: { sessionName?: string }) {
    const userId = req.user.id;
    // For now, get agency from user profile - in production this should be cached
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    return this.chatService.createSession(userId, agencyId, body.sessionName);
  }

  @Post('chat/:sessionId/message')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Request() req: any,
    @Body() body: { message: string; model?: string }
  ) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    return this.chatService.sendMessage(sessionId, userId, agencyId, body.message, body.model);
  }

  @Get('chat/sessions')
  async getUserSessions(@Request() req: any) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    return this.chatService.getUserSessions(userId, agencyId);
  }

  @Get('chat/:sessionId/history')
  async getSessionHistory(@Param('sessionId') sessionId: string, @Request() req: any) {
    const userId = req.user.id;
    return this.chatService.getSessionHistory(sessionId, userId);
  }

  @Delete('chat/:sessionId')
  async deleteSession(@Param('sessionId') sessionId: string, @Request() req: any) {
    const userId = req.user.id;
    return this.chatService.deleteSession(sessionId, userId);
  }

  @Get('recommendations')
  async getRecommendations(@Request() req: any) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    return this.chatService.generateRecommendations(agencyId, userId);
  }

  @Post('embeddings/search')
  async searchDocuments(@Request() req: any, @Body() body: { query: string; limit?: number }) {
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    return this.embeddingsService.searchSimilarDocuments(body.query, agencyId, body.limit);
  }
}
