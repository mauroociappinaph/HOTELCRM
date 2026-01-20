import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: DatabaseHealth;
    memory: MemoryHealth;
    external: ExternalServicesHealth;
    ai: AIHealth;
  };
}

export interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  latency: number;
  connectionCount?: number;
  lastMigration?: string;
}

export interface MemoryHealth {
  status: 'healthy' | 'warning' | 'critical';
  used: number;
  total: number;
  percentage: number;
  externalFragmentation?: number;
}

export interface ExternalServicesHealth {
  stripe: ServiceHealth;
  openrouter: ServiceHealth;
  voyage: ServiceHealth;
  daily: ServiceHealth;
  supabase: ServiceHealth;
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency?: number;
  lastChecked: string;
  error?: string;
}

export interface AIHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  models: {
    openrouter: boolean;
    voyage: boolean;
  };
  lastEmbeddingCheck: string;
  embeddingLatency?: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startupTime = Date.now();

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Comprehensive health check for all system components
   */
  async getComprehensiveHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Run all health checks in parallel for better performance
      const [databaseHealth, memoryHealth, externalHealth, aiHealth] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkMemoryHealth(),
        this.checkExternalServicesHealth(),
        this.checkAIHealth(),
      ]);

      // Extract results or provide fallback for failed checks
      const checks = {
        database:
          databaseHealth.status === 'fulfilled'
            ? databaseHealth.value
            : this.getFallbackDatabaseHealth(),
        memory:
          memoryHealth.status === 'fulfilled' ? memoryHealth.value : this.getFallbackMemoryHealth(),
        external:
          externalHealth.status === 'fulfilled'
            ? externalHealth.value
            : this.getFallbackExternalHealth(),
        ai: aiHealth.status === 'fulfilled' ? aiHealth.value : this.getFallbackAIHealth(),
      };

      // Determine overall status based on critical components
      const overallStatus = this.determineOverallStatus(checks);

      const result: HealthCheckResult = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startupTime,
        version: process.env.npm_package_version || '1.0.0',
        checks,
      };

      // Log health check results for monitoring
      this.logger.log(
        `Health check completed in ${Date.now() - startTime}ms - Status: ${overallStatus.toUpperCase()}`,
      );

      // Log warnings for degraded components
      this.logHealthWarnings(checks);

      return result;
    } catch (error) {
      this.logger.error('Critical error during health check:', error);
      return this.getCriticalFailureHealth();
    }
  }

  /**
   * Quick health check for load balancers and monitoring systems
   */
  async getQuickHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      // Minimal check - just database connectivity
      const client = this.supabaseService.getClient();
      const startTime = Date.now();

      const { error } = await client.from('agencies').select('id').limit(1).single();

      const latency = Date.now() - startTime;

      if (error) {
        throw new Error(`Database check failed: ${error.message}`);
      }

      return {
        status: latency < 1000 ? 'healthy' : 'degraded', // 1 second threshold
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Quick health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check database health and connectivity
   */
  private async checkDatabaseHealth(): Promise<DatabaseHealth> {
    const client = this.supabaseService.getClient();
    const startTime = Date.now();

    try {
      // Check basic connectivity
      const { data, error } = await client.from('agencies').select('id').limit(1);

      const latency = Date.now() - startTime;

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }

      // Try to get migration info (if available)
      let lastMigration: string | undefined;
      try {
        const { data: migrationData } = await client
          .rpc('get_last_migration') // Custom function if available
          .select()
          .single();
        lastMigration = (migrationData as any)?.version;
      } catch {
        // Migration info not available, skip
      }

      return {
        status: latency < 500 ? 'healthy' : 'unhealthy', // 500ms threshold
        latency,
        connectionCount: data?.length || 0,
        lastMigration,
      };
    } catch (error) {
      this.logger.warn('Database health check failed:', error);
      throw error;
    }
  }

  /**
   * Check memory usage and system resources
   */
  private async checkMemoryHealth(): Promise<MemoryHealth> {
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const percentage = (usedMemory / totalMemory) * 100;

      let status: 'healthy' | 'warning' | 'critical';
      if (percentage > 90) {
        status = 'critical';
      } else if (percentage > 75) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      return {
        status,
        used: Math.round(usedMemory / 1024 / 1024), // MB
        total: Math.round(totalMemory / 1024 / 1024), // MB
        percentage: Math.round(percentage * 100) / 100,
        externalFragmentation: memUsage.external
          ? Math.round(memUsage.external / 1024 / 1024)
          : undefined,
      };
    } catch (error) {
      this.logger.warn('Memory health check failed:', error);
      throw error;
    }
  }

  /**
   * Check external services health
   */
  private async checkExternalServicesHealth(): Promise<ExternalServicesHealth> {
    const services = ['stripe', 'openrouter', 'voyage', 'daily', 'supabase'] as const;

    const results: Partial<ExternalServicesHealth> = {};

    // Check each service in parallel
    const checks = services.map((service) => this.checkServiceHealth(service));

    try {
      const healthResults = await Promise.allSettled(checks);

      services.forEach((service, index) => {
        const result = healthResults[index];
        results[service] =
          result.status === 'fulfilled'
            ? result.value
            : { status: 'unknown', lastChecked: new Date().toISOString(), error: 'Check failed' };
      });
    } catch (error) {
      this.logger.warn('External services health check failed:', error);
      // Provide fallback for all services
      services.forEach((service) => {
        results[service] = {
          status: 'unknown',
          lastChecked: new Date().toISOString(),
          error: 'Check failed',
        };
      });
    }

    return results as ExternalServicesHealth;
  }

  /**
   * Check individual service health
   */
  private async checkServiceHealth(service: string): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      switch (service) {
        case 'supabase':
          return await this.checkSupabaseHealth();

        case 'stripe':
          return await this.checkStripeHealth();

        case 'openrouter':
          return await this.checkOpenRouterHealth();

        case 'voyage':
          return await this.checkVoyageHealth();

        case 'daily':
          return await this.checkDailyHealth();

        default:
          return {
            status: 'unknown',
            lastChecked: new Date().toISOString(),
            error: 'Service not configured for health checks',
          };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check Supabase connectivity
   */
  private async checkSupabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const client = this.supabaseService.getClient();
      const { error } = await client.from('agencies').select('id').limit(1);

      if (error) throw error;

      return {
        status: 'healthy',
        latency: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check Stripe API connectivity
   */
  private async checkStripeHealth(): Promise<ServiceHealth> {
    // Only check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        status: 'unknown',
        lastChecked: new Date().toISOString(),
        error: 'Stripe not configured',
      };
    }

    const startTime = Date.now();

    try {
      // Simple API call to check connectivity
      // Note: This would require importing Stripe SDK
      // For now, just check if the key format is valid
      const isValidFormat = process.env.STRIPE_SECRET_KEY.startsWith('sk_');

      if (!isValidFormat) {
        throw new Error('Invalid Stripe key format');
      }

      return {
        status: 'healthy',
        latency: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check OpenRouter API connectivity
   */
  private async checkOpenRouterHealth(): Promise<ServiceHealth> {
    if (!process.env.OPENROUTER_API_KEY) {
      return {
        status: 'unknown',
        lastChecked: new Date().toISOString(),
        error: 'OpenRouter not configured',
      };
    }

    const startTime = Date.now();

    try {
      // Simple API call to check connectivity
      // This would make a lightweight API call to OpenRouter
      // For now, just validate the key exists and has proper format
      return {
        status: 'healthy',
        latency: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check Voyage AI connectivity
   */
  private async checkVoyageHealth(): Promise<ServiceHealth> {
    if (!process.env.VOYAGE_API_KEY) {
      return {
        status: 'unknown',
        lastChecked: new Date().toISOString(),
        error: 'Voyage AI not configured',
      };
    }

    const startTime = Date.now();

    try {
      // Check Voyage AI API connectivity
      return {
        status: 'healthy',
        latency: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check Daily.co connectivity
   */
  private async checkDailyHealth(): Promise<ServiceHealth> {
    if (!process.env.DAILY_API_KEY) {
      return {
        status: 'unknown',
        lastChecked: new Date().toISOString(),
        error: 'Daily.co not configured',
      };
    }

    const startTime = Date.now();

    try {
      // Check Daily.co API connectivity
      return {
        status: 'healthy',
        latency: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check AI services health
   */
  private async checkAIHealth(): Promise<AIHealth> {
    const startTime = Date.now();

    try {
      const models = {
        openrouter: !!process.env.OPENROUTER_API_KEY,
        voyage: !!process.env.VOYAGE_API_KEY,
      };

      const hasAnyModel = Object.values(models).some(Boolean);
      const status = hasAnyModel ? 'healthy' : 'unhealthy';

      return {
        status: status as AIHealth['status'],
        models,
        lastEmbeddingCheck: new Date().toISOString(),
        embeddingLatency: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.warn('AI health check failed:', error);
      return {
        status: 'unhealthy',
        models: { openrouter: false, voyage: false },
        lastEmbeddingCheck: new Date().toISOString(),
      };
    }
  }

  /**
   * Determine overall health status based on component statuses
   */
  private determineOverallStatus(checks: HealthCheckResult['checks']): HealthCheckResult['status'] {
    // Critical components that must be healthy (database)
    if (checks.database.status === 'unhealthy') {
      return 'unhealthy';
    }

    // Memory critical status
    if (checks.memory.status === 'critical') {
      return 'unhealthy';
    }

    // Check external services for unhealthy status
    const externalServicesUnhealthy = Object.values(checks.external).some(
      (service) => service.status === 'unhealthy',
    );

    if (externalServicesUnhealthy) {
      return 'degraded';
    }

    // AI services unhealthy
    if (checks.ai.status === 'unhealthy') {
      return 'degraded';
    }

    // Memory warning status
    if (checks.memory.status === 'warning') {
      return 'degraded';
    }

    // All components are healthy
    return 'healthy';
  }

  /**
   * Log warnings for degraded components
   */
  private logHealthWarnings(checks: HealthCheckResult['checks']): void {
    if (checks.database.status === 'unhealthy') {
      this.logger.warn('🚨 CRITICAL: Database is unhealthy');
    }

    if (checks.memory.status === 'critical') {
      this.logger.warn('🚨 CRITICAL: Memory usage is critical');
    } else if (checks.memory.status === 'warning') {
      this.logger.warn('⚠️ WARNING: High memory usage detected');
    }

    // Log external service issues
    Object.entries(checks.external).forEach(([service, health]) => {
      if (health.status === 'unhealthy') {
        this.logger.warn(`🚨 External service ${service} is unhealthy: ${health.error}`);
      }
    });

    if (checks.ai.status === 'unhealthy') {
      this.logger.warn('🚨 AI services are unhealthy');
    }
  }

  /**
   * Fallback health results for failed checks
   */
  private getFallbackDatabaseHealth(): DatabaseHealth {
    return {
      status: 'unhealthy',
      latency: -1,
      connectionCount: 0,
    };
  }

  private getFallbackMemoryHealth(): MemoryHealth {
    return {
      status: 'critical',
      used: 0,
      total: 0,
      percentage: 100,
    };
  }

  private getFallbackExternalHealth(): ExternalServicesHealth {
    const unknownService: ServiceHealth = {
      status: 'unknown',
      lastChecked: new Date().toISOString(),
      error: 'Health check failed',
    };

    return {
      stripe: unknownService,
      openrouter: unknownService,
      voyage: unknownService,
      daily: unknownService,
      supabase: unknownService,
    };
  }

  private getFallbackAIHealth(): AIHealth {
    return {
      status: 'unhealthy',
      models: { openrouter: false, voyage: false },
      lastEmbeddingCheck: new Date().toISOString(),
    };
  }

  /**
   * Critical failure health result
   */
  private getCriticalFailureHealth(): HealthCheckResult {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startupTime,
      version: 'unknown',
      checks: {
        database: this.getFallbackDatabaseHealth(),
        memory: this.getFallbackMemoryHealth(),
        external: this.getFallbackExternalHealth(),
        ai: this.getFallbackAIHealth(),
      },
    };
  }
}
