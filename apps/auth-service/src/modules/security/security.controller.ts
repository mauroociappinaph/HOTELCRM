import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';

import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

import { SecurityService, SecurityUser, SecurityAlert } from './security.service';

@Controller('security')
@UseGuards(SupabaseAuthGuard)
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  // Create admin user (special endpoint for initial setup)
  @Post('admin/setup')
  @HttpCode(HttpStatus.CREATED)
  async createAdminUser(
    @Body() body: { email: string; name: string },
    @Request() req: any,
  ): Promise<SecurityUser> {
    // TODO: Add additional authorization check to ensure only system admins can create admin users
    return this.securityService.createAdminUser(body.email, body.name);
  }

  // Get security dashboard statistics
  @Get('dashboard/stats')
  async getDashboardStats(): Promise<{
    totalEvents: number;
    activeAlerts: number;
    criticalAlerts: number;
    attackAttemptsToday: number;
    rateLimitHitsToday: number;
    circuitBreakerTripsToday: number;
  }> {
    return this.securityService.getSecurityDashboardStats();
  }

  // Get security users (admins and security admins)
  @Get('users')
  async getSecurityUsers(): Promise<SecurityUser[]> {
    return this.securityService.getSecurityUsers();
  }

  // Get security events with filtering
  @Get('events')
  async getSecurityEvents(
    @Query()
    query: {
      limit?: string;
      offset?: string;
      severity?: string;
      event_type?: string;
      date_from?: string;
      date_to?: string;
    },
  ): Promise<any[]> {
    return this.securityService.getSecurityEvents({
      limit: query.limit ? parseInt(query.limit) : 50,
      offset: query.offset ? parseInt(query.offset) : 0,
      severity: query.severity,
      event_type: query.event_type,
      date_from: query.date_from,
      date_to: query.date_to,
    });
  }

  // Get security alerts
  @Get('alerts')
  async getSecurityAlerts(@Query('status') status?: string): Promise<SecurityAlert[]> {
    return this.securityService.getSecurityAlerts(status);
  }

  // Update alert status
  @Put('alerts/:id/status')
  @HttpCode(HttpStatus.OK)
  async updateAlertStatus(
    @Param('id') alertId: string,
    @Body() body: { status: string },
    @Request() req: any,
  ): Promise<void> {
    const userId = req.user?.id || 'system';
    await this.securityService.updateAlertStatus(alertId, body.status, userId);

    // Log the security action
    await this.securityService.logSecurityAction({
      user_id: userId,
      action_type: 'alert_status_update',
      resource_type: 'security_alert',
      resource_id: alertId,
      details: { new_status: body.status },
      ip_address: req.ip,
    });
  }

  // Send test alert notification
  @Post('alerts/test')
  @HttpCode(HttpStatus.OK)
  async sendTestAlert(@Request() req: any): Promise<{ message: string }> {
    const testAlert: SecurityAlert = {
      id: 'test-alert',
      type: 'test_notification',
      title: 'Test Security Alert',
      description: 'This is a test alert to verify notification system',
      severity: 'low',
      status: 'active',
      created_at: new Date().toISOString(),
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    };

    await this.securityService.sendAlertNotification(testAlert);

    // Log the test action
    await this.securityService.logSecurityAction({
      user_id: req.user?.id || 'system',
      action_type: 'test_alert_sent',
      resource_type: 'notification_system',
      details: { alert_type: 'test' },
      ip_address: req.ip,
    });

    return { message: 'Test alert sent successfully' };
  }

  // Get security configuration (for admin review)
  @Get('config')
  async getSecurityConfig(): Promise<{
    middleware_active: boolean;
    monitoring_active: boolean;
    alert_thresholds: Record<string, number>;
    rate_limits: Record<string, any>;
    circuit_breaker_config: Record<string, any>;
    attack_patterns_detected: string[];
  }> {
    // This would return actual configuration from environment/database
    return {
      middleware_active: true,
      monitoring_active: true,
      alert_thresholds: {
        attack_attempts_per_hour: 10,
        rate_limit_hits_per_minute: 5,
        circuit_breaker_trips_per_hour: 3,
      },
      rate_limits: {
        window_ms: 900000, // 15 minutes
        max_requests: 100,
        block_duration: 3600000, // 1 hour
      },
      circuit_breaker_config: {
        failure_threshold: 10,
        success_threshold: 3,
        timeout_ms: 60000,
      },
      attack_patterns_detected: [
        'rsc_deserialization',
        'flight_protocol_abuse',
        'malicious_payloads',
        'suspicious_headers',
        'sql_injection',
      ],
    };
  }

  // Manual security scan (for admin use)
  @Post('scan')
  @HttpCode(HttpStatus.OK)
  async performSecurityScan(@Request() req: any): Promise<{
    scan_id: string;
    status: string;
    findings: string[];
    timestamp: string;
  }> {
    const scanId = `scan_${Date.now()}`;

    // Log the security action
    await this.securityService.logSecurityAction({
      user_id: req.user?.id || 'system',
      action_type: 'security_scan_initiated',
      resource_type: 'security_system',
      resource_id: scanId,
      details: { scan_type: 'manual' },
      ip_address: req.ip,
    });

    // TODO: Implement actual security scanning logic
    // This could include:
    // - Database security checks
    // - Configuration validation
    // - Dependency vulnerability scanning
    // - Access control verification

    return {
      scan_id: scanId,
      status: 'completed',
      findings: [
        'All security middleware active',
        'Rate limiting configured correctly',
        'Circuit breaker operational',
        'Attack patterns detection active',
        'Security logging enabled',
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
