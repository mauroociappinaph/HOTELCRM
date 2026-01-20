import { Logger } from '@nestjs/common';

/**
 * Environment variables validation
 * Ensures all required secrets and configuration are present at startup
 */
export class EnvironmentValidation {
  private static readonly logger = new Logger('EnvironmentValidation');

  /**
   * Critical environment variables that must be present
   */
  private static readonly REQUIRED_VARS = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
  ] as const;

  /**
   * Optional but recommended environment variables
   */
  private static readonly RECOMMENDED_VARS = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'OPENROUTER_API_KEY',
    'VOYAGE_API_KEY',
    'DAILY_API_KEY',
    'FRONTEND_URL',
  ] as const;

  /**
   * Validate all required environment variables
   * Throws error if any required variable is missing
   */
  static validateRequired(): void {
    const missing: string[] = [];

    for (const varName of this.REQUIRED_VARS) {
      if (!process.env[varName] || process.env[varName]?.trim() === '') {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      const errorMsg = `❌ Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file and ensure all required variables are set.';
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.logger.log('✅ All required environment variables are present');
  }

  /**
   * Check for recommended but optional environment variables
   * Logs warnings if they are missing but doesn't throw errors
   */
  static checkRecommended(): void {
    const missing: string[] = [];

    for (const varName of this.RECOMMENDED_VARS) {
      if (!process.env[varName] || process.env[varName]?.trim() === '') {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      this.logger.warn(`⚠️  Missing recommended environment variables: ${missing.join(', ')}`);
      this.logger.warn('Some features may not work correctly without these variables.');
    } else {
      this.logger.log('✅ All recommended environment variables are present');
    }
  }

  /**
   * Validate environment variable formats and values
   */
  static validateFormats(): void {
    const errors: string[] = [];

    // Validate SUPABASE_URL format
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl && !supabaseUrl.match(/^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/)) {
      errors.push('SUPABASE_URL must be a valid Supabase URL (https://xxx.supabase.co)');
    }

    // Validate JWT_SECRET minimum length
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push('JWT_SECRET should be at least 32 characters long for security');
    }

    // Validate FRONTEND_URL format if present
    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl && !frontendUrl.match(/^https?:\/\/.+/)) {
      errors.push('FRONTEND_URL must be a valid HTTP/HTTPS URL');
    }

    // Validate Stripe keys format
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && !stripeKey.startsWith('sk_')) {
      errors.push('STRIPE_SECRET_KEY must start with "sk_"');
    }

    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (stripeWebhookSecret && !stripeWebhookSecret.startsWith('whsec_')) {
      errors.push('STRIPE_WEBHOOK_SECRET must start with "whsec_"');
    }

    if (errors.length > 0) {
      const errorMsg = `❌ Environment variable format errors:\n${errors.join('\n')}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    this.logger.log('✅ Environment variable formats are valid');
  }

  /**
   * Validate database connectivity (optional, can be skipped in CI)
   */
  static async validateDatabaseConnection(): Promise<void> {
    if (process.env.SKIP_DB_CHECK === 'true') {
      this.logger.log('⏭️  Skipping database connection validation');
      return;
    }

    try {
      // This would require importing the SupabaseService
      // For now, just log that validation is recommended
      this.logger.log('ℹ️  Database connection validation recommended for production');
    } catch (error) {
      this.logger.warn('⚠️  Database connection validation failed:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Run all validation checks
   * Call this at application startup
   */
  static async validateAll(): Promise<void> {
    this.logger.log('🔍 Starting environment validation...');

    try {
      // Required variables
      this.validateRequired();

      // Formats validation
      this.validateFormats();

      // Recommended variables check
      this.checkRecommended();

      // Database connection (optional)
      await this.validateDatabaseConnection();

      this.logger.log('🎉 Environment validation completed successfully');

    } catch (error) {
      this.logger.error('💥 Environment validation failed');
      throw error;
    }
  }

  /**
   * Get validation summary for logging/debugging
   */
  static getValidationSummary(): Record<string, any> {
    const summary = {
      required: {
        total: this.REQUIRED_VARS.length,
        present: this.REQUIRED_VARS.filter(v => process.env[v]).length,
        missing: this.REQUIRED_VARS.filter(v => !process.env[v]),
      },
      recommended: {
        total: this.RECOMMENDED_VARS.length,
        present: this.RECOMMENDED_VARS.filter(v => process.env[v]).length,
        missing: this.RECOMMENDED_VARS.filter(v => !process.env[v]),
      },
      timestamp: new Date().toISOString(),
    };

    return summary;
  }
}
