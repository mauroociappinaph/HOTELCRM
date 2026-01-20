import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

/**
 * DataDog APM Monitoring Service
 * Configures application performance monitoring and tracing
 */
@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private isInitialized = false;
  private dataDogAvailable = false;

  async onModuleInit() {
    await this.initializeMonitoring();
  }

  /**
   * Initialize DataDog APM monitoring
   */
  private async initializeMonitoring(): Promise<void> {
    try {
      // Check if DataDog is configured
      const apiKey = process.env.DD_API_KEY;
      const serviceName = process.env.DD_SERVICE_NAME || 'hotelcrm-auth-service';
      const env = process.env.DD_ENV || process.env.NODE_ENV || 'development';

      if (!apiKey) {
        this.logger.warn('⚠️  DataDog API key not found. APM monitoring disabled.');
        this.logger.warn('Set DD_API_KEY environment variable to enable DataDog monitoring.');
        return;
      }

      // Check if dd-trace is available at runtime
      await this.checkDataDogAvailability();

      if (!this.dataDogAvailable) {
        this.logger.warn('📊 DataDog dd-trace package not found. APM monitoring disabled.');
        this.logger.warn('To enable APM monitoring, install dd-trace: npm install dd-trace');
        return;
      }

      // Initialize DataDog tracer
      await this.initializeDataDogTracer(apiKey, serviceName, env);

      // Initialize custom metrics
      this.initializeCustomMetrics();

      // Set up error tracking
      this.setupErrorTracking();

      // Set up performance monitoring
      this.setupPerformanceMonitoring();

      this.isInitialized = true;
      this.logger.log('✅ DataDog APM monitoring initialized successfully');

    } catch (error) {
      this.logger.error('❌ Failed to initialize DataDog monitoring:', error);
      this.logger.warn('Application will continue without APM monitoring');
    }
  }

  /**
   * Check if DataDog dd-trace is available at runtime
   */
  private async checkDataDogAvailability(): Promise<void> {
    try {
      // Use eval to avoid TypeScript compilation issues
      const tracer = eval('require')('dd-trace');
      this.dataDogAvailable = !!tracer;
    } catch (error) {
      this.dataDogAvailable = false;
    }
  }

  /**
   * Initialize DataDog tracer
   */
  private async initializeDataDogTracer(apiKey: string, serviceName: string, env: string): Promise<void> {
    try {
      // Use eval to dynamically require dd-trace at runtime
      const tracer = eval('require')('dd-trace');

      // Initialize the tracer
      tracer.init({
        // Core configuration
        service: serviceName,
        env: env,
        version: process.env.npm_package_version || '1.0.0',

        // Sampling and rates
        sampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0'),
        ingestion: {
          sampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0'),
        },

        // Runtime metrics
        runtimeMetrics: true,
        experimental: {
          runtimeId: true,
        },

        // Tagging
        tags: {
          'service.name': serviceName,
          'service.version': process.env.npm_package_version || '1.0.0',
          'env': env,
          'team': 'hotelcrm',
          'component': 'auth-service',
        },

        // Instrumentation
        logInjection: true,
        queryStringObfuscation: true,

        // Performance settings
        flushInterval: 20000, // 20 seconds
        flushMinSpans: 1000,
      });

      // Configure plugins for specific integrations
      tracer.use('http', {
        service: `${serviceName}-http`,
        splitByDomain: true,
      });

      tracer.use('pg', {
        service: `${serviceName}-postgres`,
      });

      this.logger.log(`📊 DataDog tracer initialized for service: ${serviceName} in env: ${env}`);

    } catch (error) {
      this.logger.error('Failed to initialize DataDog tracer:', error);
      throw error;
    }
  }

  /**
   * Initialize custom metrics collection
   */
  private initializeCustomMetrics(): void {
    try {
      if (!this.dataDogAvailable) {
        this.logger.warn('DataDog not available, custom metrics disabled');
        return;
      }

      const tracer = eval('require')('dd-trace');

      if (!tracer?.dogstatsd) {
        this.logger.warn('DataDog dogstatsd not available, custom metrics disabled');
        return;
      }

      const statsd = tracer.dogstatsd;

      // Custom metrics for business logic
      this.setupBusinessMetrics(statsd);

      // Custom metrics for performance
      this.setupPerformanceMetrics(statsd);

      // Custom metrics for errors
      this.setupErrorMetrics(statsd);

      this.logger.log('📈 Custom metrics initialized');

    } catch (error) {
      this.logger.warn('Custom metrics initialization failed:', error);
    }
  }

  /**
   * Setup business-specific metrics
   */
  private setupBusinessMetrics(statsd: any): void {
    // These would be called from various services to track business metrics
    // For example:
    // statsd.increment('auth.login.success');
    // statsd.increment('auth.login.failure');
    // statsd.histogram('auth.token_generation_time', duration);

    this.logger.log('💼 Business metrics configured');
  }

  /**
   * Setup performance metrics
   */
  private setupPerformanceMetrics(statsd: any): void {
    // Memory usage tracking
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

      statsd.gauge('nodejs.heap.used', heapUsedMB);
      statsd.gauge('nodejs.heap.total', heapTotalMB);
      statsd.gauge('nodejs.heap.percentage', (heapUsedMB / heapTotalMB) * 100);
    }, 30000); // Every 30 seconds

    // Event loop lag monitoring
    let lastCheck = Date.now();
    setInterval(() => {
      const now = Date.now();
      const lag = now - lastCheck - 1000; // Expected 1 second interval
      lastCheck = now;

      if (lag > 0) {
        statsd.histogram('nodejs.event_loop.lag', lag);
      }
    }, 1000);

    this.logger.log('⚡ Performance metrics configured');
  }

  /**
   * Setup error tracking metrics
   */
  private setupErrorMetrics(statsd: any): void {
    // Error rate tracking
    process.on('uncaughtException', (error) => {
      statsd.increment('nodejs.errors.uncaught_exception');
      this.logger.error('Uncaught exception tracked:', error.message);
    });

    process.on('unhandledRejection', (reason, promise) => {
      statsd.increment('nodejs.errors.unhandled_rejection');
      this.logger.error('Unhandled rejection tracked:', reason);
    });

    this.logger.log('🚨 Error metrics configured');
  }

  /**
   * Setup error tracking and reporting
   */
  private setupErrorTracking(): void {
    try {
      // Global error handler for uncaught exceptions
      process.on('uncaughtException', (error) => {
        this.logger.error('🚨 Uncaught Exception:', error);
        // In production, you might want to send this to error reporting service
        // like Sentry, Rollbar, etc.
      });

      process.on('unhandledRejection', (reason, promise) => {
        this.logger.error('🚨 Unhandled Rejection:', reason);
        // Log the stack trace if available
        if (reason instanceof Error) {
          this.logger.error(reason.stack);
        }
      });

      // Graceful shutdown handling
      process.on('SIGTERM', () => {
        this.logger.log('📤 SIGTERM received, shutting down gracefully...');
        this.gracefulShutdown();
      });

      process.on('SIGINT', () => {
        this.logger.log('📤 SIGINT received, shutting down gracefully...');
        this.gracefulShutdown();
      });

      this.logger.log('🛡️ Error tracking configured');

    } catch (error) {
      this.logger.warn('Error tracking setup failed:', error);
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    try {
      // Monitor heap growth (without overriding setTimeout to avoid type issues)
      let lastHeapUsed = process.memoryUsage().heapUsed;
      setInterval(() => {
        const currentHeapUsed = process.memoryUsage().heapUsed;
        const growth = currentHeapUsed - lastHeapUsed;

        if (growth > 10 * 1024 * 1024) { // 10MB growth
          this.logger.warn(`⚠️  Significant heap growth detected: ${Math.round(growth / 1024 / 1024)}MB`);
        }

        lastHeapUsed = currentHeapUsed;
      }, 60000); // Every minute

      // Monitor active handles and requests (using safe property access)
      setInterval(() => {
        try {
          const proc = process as any;
          const handles = proc._getActiveHandles?.() || [];
          const requests = proc._getActiveRequests?.() || [];

          if (handles.length > 100) {
            this.logger.warn(`⚠️  High number of active handles: ${handles.length}`);
          }

          if (requests.length > 50) {
            this.logger.warn(`⚠️  High number of active requests: ${requests.length}`);
          }
        } catch (error) {
          // Ignore errors in process monitoring
        }
      }, 30000); // Every 30 seconds

      this.logger.log('📊 Performance monitoring configured');

    } catch (error) {
      this.logger.warn('Performance monitoring setup failed:', error);
    }
  }

  /**
   * Graceful shutdown handling
   */
  private gracefulShutdown(): void {
    try {
      this.logger.log('🛑 Initiating graceful shutdown...');

      // Flush any pending DataDog spans
      if (this.dataDogAvailable) {
        try {
          const tracer = eval('require')('dd-trace');
          if (tracer?.flush) {
            tracer.flush();
          }
        } catch (error) {
          // Ignore errors during shutdown
        }
      }

      // Allow some time for cleanup
      setTimeout(() => {
        this.logger.log('✅ Graceful shutdown completed');
        process.exit(0);
      }, 5000);

    } catch (error) {
      this.logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Check if monitoring is initialized
   */
  public isMonitoringEnabled(): boolean {
    return this.isInitialized;
  }

  /**
   * Get monitoring status
   */
  public getMonitoringStatus() {
    return {
      enabled: this.isInitialized,
      service: process.env.DD_SERVICE_NAME || 'hotelcrm-auth-service',
      environment: process.env.DD_ENV || process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      apiKeyConfigured: !!process.env.DD_API_KEY,
      initializedAt: this.isInitialized ? new Date().toISOString() : null,
    };
  }

  /**
   * Manually trigger a health check for monitoring
   */
  public async triggerHealthCheck(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn('Monitoring not initialized, skipping health check');
      return;
    }

    try {
      // This could send a custom health check metric to DataDog
      if (this.dataDogAvailable) {
        try {
          const tracer = eval('require')('dd-trace');
          if (tracer?.dogstatsd) {
            tracer.dogstatsd.increment('app.health_check');
          }
        } catch (error) {
          // Ignore if metrics not available
        }
      }

      this.logger.log('🔍 Health check triggered successfully');

    } catch (error) {
      this.logger.error('Health check trigger failed:', error);
    }
  }
}
