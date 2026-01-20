import { Controller, Get, Logger } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  /**
   * Quick health check for load balancers and monitoring systems
   * Returns simple status for fast health checks
   */
  @Get()
  async getHealth() {
    try {
      const health = await this.healthService.getQuickHealth();
      return {
        status: health.status,
        timestamp: health.timestamp,
        service: 'HOTELCRM Auth Service',
        uptime: process.uptime(),
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'HOTELCRM Auth Service',
        error: 'Health check failed',
      };
    }
  }

  /**
   * Comprehensive health check with detailed component status
   * Used for monitoring dashboards and detailed diagnostics
   */
  @Get('detailed')
  async getDetailedHealth() {
    try {
      const comprehensiveHealth = await this.healthService.getComprehensiveHealth();

      return {
        status: comprehensiveHealth.status,
        timestamp: comprehensiveHealth.timestamp,
        service: 'HOTELCRM Auth Service',
        version: comprehensiveHealth.version,
        uptime: comprehensiveHealth.uptime,
        checks: comprehensiveHealth.checks,
      };
    } catch (error) {
      this.logger.error('Detailed health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'HOTELCRM Auth Service',
        error: 'Detailed health check failed',
        uptime: process.uptime(),
      };
    }
  }

  /**
   * Legacy endpoint for backward compatibility
   * @deprecated Use /health/detailed instead
   */
  @Get('status')
  async getStatus() {
    this.logger.warn('Using deprecated /health/status endpoint, consider using /health/detailed');
    return this.getDetailedHealth();
  }
}
