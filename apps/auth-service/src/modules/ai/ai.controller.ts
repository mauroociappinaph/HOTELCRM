import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';

import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AuthenticatedRequest } from '../../common/interfaces/request.interface';

import { ChatService } from './chat.service';
import { EmbeddingsService } from './embeddings.service';

@Controller('ai')
@UseGuards(SupabaseAuthGuard)
export class AiController {
  constructor(
    private readonly chatService: ChatService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  @Post('chat/session')
  async createSession(@Request() req: AuthenticatedRequest, @Body() body: { sessionName?: string }) {
    const userId = req.user.id;
    // For now, get agency from user profile - in production this should be cached
    const agencyId = (req.user.user_metadata?.agency_id as string) || 'default';
    return this.chatService.createSession(userId, agencyId, body.sessionName);
  }

  @Post('chat/:sessionId/message')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { message: string; model?: string },
  ) {
    const userId = req.user.id;
    const agencyId = (req.user.user_metadata?.agency_id as string) || 'default';
    return this.chatService.sendMessage(sessionId, userId, agencyId, body.message, body.model);
  }

  @Get('chat/sessions')
  async getUserSessions(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const agencyId = (req.user.user_metadata?.agency_id as string) || 'default';
    return this.chatService.getUserSessions(userId, agencyId);
  }

  @Get('chat/:sessionId/history')
  async getSessionHistory(@Param('sessionId') sessionId: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.chatService.getSessionHistory(sessionId, userId);
  }

  @Delete('chat/:sessionId')
  async deleteSession(@Param('sessionId') sessionId: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.chatService.deleteSession(sessionId, userId);
  }

  @Get('recommendations')
  async getRecommendations(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    const agencyId = (req.user.user_metadata?.agency_id as string) || 'default';
    return this.chatService.generateRecommendations(agencyId, userId);
  }

  @Post('embeddings/search')
  async searchDocuments(@Request() req: AuthenticatedRequest, @Body() body: { query: string; limit?: number }) {
    const agencyId = (req.user.user_metadata?.agency_id as string) || 'default';
    return this.embeddingsService.searchSimilarDocuments(body.query, agencyId, body.limit);
  }
}
