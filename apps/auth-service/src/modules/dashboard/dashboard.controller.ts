import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { DashboardDataDto } from '@hotel-crm/shared';

import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(SupabaseAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getDashboardStats(@Request() req: any): Promise<DashboardDataDto> {
    const userId = req.user.id;
    return this.dashboardService.getDashboardStats(userId);
  }
}
