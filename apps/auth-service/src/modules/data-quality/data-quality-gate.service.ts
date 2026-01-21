import { Injectable, Logger } from '@nestjs/common';

import { SchemaValidatorService, ValidationResult } from './schema-validator.service';
import {
  BusinessRulesEngineService,
  BusinessRulesValidationResult,
} from './business-rules-engine.service';
import { QuarantineService } from './quarantine.service';

export interface QualityGateConfig {
  gateId: string;
  name: string;
  description: string;
  schemaId?: string; // Schema to validate against
  ruleCategories?: string[]; // Business rule categories to check
  strictMode: boolean; // Reject on any error vs reject only on critical errors
  quarantineEnabled: boolean; // Send rejected records to quarantine
  enabled: boolean;
}

export interface DataQualityCheck {
  schemaValidation?: ValidationResult;
  businessRulesValidation?: BusinessRulesValidationResult;
  overallResult: boolean;
  rejectedReason?: string;
  checkTime: number;
}

export interface QualityGateResult {
  gateId: string;
  recordId: string;
  passed: boolean;
  rejectedReason?: string;
  quarantined: boolean;
  checks: DataQualityCheck;
  processingTime: number;
}

export interface QualityGateStats {
  gateId: string;
  totalProcessed: number;
  totalPassed: number;
  totalRejected: number;
  totalQuarantined: number;
  rejectionReasons: Record<string, number>;
  averageProcessingTime: number;
  uptime: number;
}

export class DataQualityException extends Error {
  constructor(
    message: string,
    public readonly gateId: string,
    public readonly recordId: string,
    public readonly rejectionReason: string,
    public readonly validationErrors: any[],
  ) {
    super(message);
    this.name = 'DataQualityException';
  }
}

@Injectable()
export class DataQualityGateService {
  private readonly logger = new Logger(DataQualityGateService.name);
  private gates = new Map<string, QualityGateConfig>();
  private stats = new Map<string, QualityGateStats>();

  constructor(
    private readonly schemaValidator: SchemaValidatorService,
    private readonly businessRulesEngine: BusinessRulesEngineService,
    private readonly quarantineService: QuarantineService,
  ) {}

  /**
   * Register a quality gate
   */
  registerGate(config: QualityGateConfig): void {
    this.gates.set(config.gateId, config);

    // Initialize stats
    this.stats.set(config.gateId, {
      gateId: config.gateId,
      totalProcessed: 0,
      totalPassed: 0,
      totalRejected: 0,
      totalQuarantined: 0,
      rejectionReasons: {},
      averageProcessingTime: 0,
      uptime: Date.now(),
    });

    this.logger.log(`🚧 Registered quality gate: ${config.name} (${config.gateId})`);
  }

  /**
   * Validate a record through a quality gate
   */
  async validateRecord(
    agencyId: string,
    gateId: string,
    record: any,
    recordId: string,
    context?: any,
  ): Promise<QualityGateResult> {
    const startTime = Date.now();
    const gate = this.gates.get(gateId);

    if (!gate || !gate.enabled) {
      throw new Error(`Quality gate ${gateId} not found or disabled`);
    }

    const checks: DataQualityCheck = {
      checkTime: startTime,
      overallResult: true,
    };

    let rejectedReason: string | undefined;
    let quarantined = false;

    try {
      // 1. Schema validation
      if (gate.schemaId) {
        checks.schemaValidation = this.schemaValidator.validateData(gate.schemaId, record);
        if (!checks.schemaValidation.isValid) {
          rejectedReason = 'Schema validation failed';
          checks.overallResult = false;
        }
      }

      // 2. Business rules validation
      if (gate.ruleCategories && gate.ruleCategories.length > 0) {
        checks.businessRulesValidation = await this.businessRulesEngine.validateRecord(
          record,
          recordId,
          gate.ruleCategories,
          context,
        );

        if (!checks.businessRulesValidation.overallResult) {
          if (!rejectedReason) rejectedReason = 'Business rules validation failed';
          checks.overallResult = false;
        }
      }

      // 3. Strict mode check
      if (!gate.strictMode && checks.overallResult === false) {
        // In non-strict mode, only reject if there are critical errors
        const hasCriticalErrors = this.hasCriticalErrors(checks);
        checks.overallResult = !hasCriticalErrors;
        if (hasCriticalErrors) {
          rejectedReason = 'Critical validation errors found';
        } else {
          rejectedReason = undefined; // Clear rejection for non-critical issues
        }
      }

      // 4. Handle rejection
      if (!checks.overallResult && rejectedReason) {
        if (gate.quarantineEnabled) {
          await this.quarantineService.storeRejectedRecord({
            agencyId,
            recordId,
            gateId,
            record,
            rejectionReason: rejectedReason,
            validationErrors: this.collectValidationErrors(checks),
            priority: this.calculatePriority(rejectedReason),
            context,
          });
          quarantined = true;
        }

        // Update stats
        this.updateGateStats(gateId, false, rejectedReason, quarantined);

        throw new DataQualityException(
          `Record ${recordId} rejected by quality gate ${gateId}: ${rejectedReason}`,
          gateId,
          recordId,
          rejectedReason,
          this.collectValidationErrors(checks),
        );
      }

      // Update stats for passed records
      this.updateGateStats(gateId, true, undefined, false);
    } catch (error) {
      if (error instanceof DataQualityException) {
        throw error; // Re-throw quality exceptions
      }

      // Handle unexpected errors
      rejectedReason = `Unexpected validation error: ${error instanceof Error ? error.message : String(error)}`;
      checks.overallResult = false;

      if (gate.quarantineEnabled) {
        await this.quarantineService.storeRejectedRecord({
          agencyId,
          recordId,
          gateId,
          record,
          rejectionReason: rejectedReason,
          validationErrors: [{ error: error instanceof Error ? error.message : String(error) }],
          priority: this.calculatePriority(rejectedReason),
          context,
        });
        quarantined = true;
      }

      this.updateGateStats(gateId, false, rejectedReason, quarantined);

      throw new DataQualityException(
        `Record ${recordId} failed quality gate ${gateId}: ${rejectedReason}`,
        gateId,
        recordId,
        rejectedReason,
        [{ error: error instanceof Error ? error.message : String(error) }],
      );
    }

    const processingTime = Date.now() - startTime;

    return {
      gateId,
      recordId,
      passed: checks.overallResult,
      rejectedReason,
      quarantined,
      checks,
      processingTime,
    };
  }

  /**
   * Validate multiple records through a quality gate
   */
  async validateRecordsBatch(
    agencyId: string,
    gateId: string,
    records: Array<{ record: any; recordId: string }>,
    context?: any,
    parallelValidation: boolean = true,
  ): Promise<QualityGateResult[]> {
    if (parallelValidation) {
      const promises = records.map(({ record, recordId }) =>
        this.validateRecord(agencyId, gateId, record, recordId, context),
      );
      return Promise.all(promises);
    } else {
      const results: QualityGateResult[] = [];
      for (const { record, recordId } of records) {
        try {
          const result = await this.validateRecord(agencyId, gateId, record, recordId, context);
          results.push(result);
        } catch (error) {
          // For batch processing, we'll collect errors in results
          if (error instanceof DataQualityException) {
            results.push({
              gateId,
              recordId,
              passed: false,
              rejectedReason: error.rejectionReason,
              quarantined: true, // Assuming quarantine is enabled
              checks: {
                overallResult: false,
                checkTime: Date.now(),
              },
              processingTime: 0,
            });
          }
        }
      }
      return results;
    }
  }

  /**
   * Get quality gate statistics
   */
  getGateStats(gateId: string): QualityGateStats | undefined {
    return this.stats.get(gateId);
  }

  /**
   * Get all quality gates
   */
  getAllGates(): QualityGateConfig[] {
    return Array.from(this.gates.values());
  }

  /**
   * Enable/disable a quality gate
   */
  setGateEnabled(gateId: string, enabled: boolean): boolean {
    const gate = this.gates.get(gateId);
    if (!gate) return false;

    gate.enabled = enabled;
    this.logger.log(`${enabled ? '✅ Enabled' : '❌ Disabled'} quality gate: ${gateId}`);
    return true;
  }

  /**
   * Register HOTELCRM quality gates
   */
  registerHotelCrmGates(): void {
    // Payments Quality Gate
    this.registerGate({
      gateId: 'payments-gate',
      name: 'Payments Quality Gate',
      description: 'Validates payment records before database insertion',
      schemaId: 'payment-schema',
      ruleCategories: ['payments', 'data-quality'],
      strictMode: true,
      quarantineEnabled: true,
      enabled: true,
    });

    // Bookings Quality Gate
    this.registerGate({
      gateId: 'bookings-gate',
      name: 'Bookings Quality Gate',
      description: 'Validates booking records before database insertion',
      schemaId: 'booking-schema',
      ruleCategories: ['bookings', 'data-quality'],
      strictMode: true,
      quarantineEnabled: true,
      enabled: true,
    });

    // Clients Quality Gate
    this.registerGate({
      gateId: 'clients-gate',
      name: 'Clients Quality Gate',
      description: 'Validates client records before database insertion',
      schemaId: 'client-schema',
      ruleCategories: ['clients', 'data-quality'],
      strictMode: false, // Allow non-critical issues
      quarantineEnabled: true,
      enabled: true,
    });

    // General Data Quality Gate
    this.registerGate({
      gateId: 'general-gate',
      name: 'General Data Quality Gate',
      description: 'General data quality validation for all records',
      ruleCategories: ['data-quality'],
      strictMode: true,
      quarantineEnabled: false, // Don't quarantine general validations
      enabled: true,
    });

    this.logger.log('🏨 Registered HOTELCRM quality gates');
  }

  /**
   * Register HOTELCRM schemas
   */
  registerHotelCrmSchemas(): void {
    // Payment Schema
    this.schemaValidator.registerSchema('payment-schema', {
      type: 'object',
      required: ['id', 'amount', 'currency', 'status'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        amount: { type: 'number', minimum: 0 },
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'ARS'] },
        status: { type: 'string', enum: ['succeeded', 'pending', 'failed', 'canceled'] },
        stripePaymentIntentId: { type: 'string', pattern: '^pi_' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    });

    // Booking Schema
    this.schemaValidator.registerSchema('booking-schema', {
      type: 'object',
      required: ['id', 'checkInDate', 'checkOutDate', 'guests'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        checkInDate: { type: 'string', format: 'date-time' },
        checkOutDate: { type: 'string', format: 'date-time' },
        guests: { type: 'number', minimum: 1, maximum: 20 },
        roomType: { type: 'string', enum: ['standard', 'deluxe', 'suite', 'presidential'] },
        totalAmount: { type: 'number', minimum: 0 },
        status: { type: 'string', enum: ['confirmed', 'pending', 'canceled', 'completed'] },
      },
    });

    // Client Schema
    this.schemaValidator.registerSchema('client-schema', {
      type: 'object',
      required: ['id', 'email'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        email: { type: 'string', format: 'email' },
        firstName: { type: 'string', minLength: 1, maxLength: 50 },
        lastName: { type: 'string', minLength: 1, maxLength: 50 },
        phone: { type: 'string', pattern: '^[+]?[0-9\\s\\-()]{10,20}$' },
        age: { type: 'number', minimum: 0, maximum: 150 },
        nationality: { type: 'string', minLength: 2, maxLength: 50 },
      },
    });

    this.logger.log('📋 Registered HOTELCRM data schemas');
  }

  /**
   * Check if validation results have critical errors
   */
  private hasCriticalErrors(checks: DataQualityCheck): boolean {
    // Schema validation critical errors
    if (checks.schemaValidation && !checks.schemaValidation.isValid) {
      const criticalCodes = ['MISSING_REQUIRED_FIELD', 'INVALID_TYPE', 'INVALID_UUID_FORMAT'];
      return checks.schemaValidation.errors.some((error) => criticalCodes.includes(error.code));
    }

    // Business rules critical failures
    if (checks.businessRulesValidation && !checks.businessRulesValidation.overallResult) {
      return checks.businessRulesValidation.failedRules.some(
        (rule) =>
          rule.ruleId.includes('critical') ||
          ['PAYMENT_AMOUNT_NEGATIVE', 'BOOKING_DATES_INVALID', 'EVENT_TIME_FUTURE'].includes(
            rule.errorCode || '',
          ),
      );
    }

    return false;
  }

  /**
   * Collect all validation errors
   */
  private collectValidationErrors(checks: DataQualityCheck): any[] {
    const errors: any[] = [];

    if (checks.schemaValidation) {
      errors.push(...checks.schemaValidation.errors);
    }

    if (checks.businessRulesValidation) {
      errors.push(
        ...checks.businessRulesValidation.failedRules.map((rule) => ({
          ruleId: rule.ruleId,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage,
        })),
      );
    }

    return errors;
  }

  /**
   * Update quality gate statistics
   */
  private updateGateStats(
    gateId: string,
    passed: boolean,
    rejectionReason?: string,
    quarantined?: boolean,
  ): void {
    const stats = this.stats.get(gateId);
    if (!stats) return;

    stats.totalProcessed++;

    if (passed) {
      stats.totalPassed++;
    } else {
      stats.totalRejected++;
      if (rejectionReason) {
        stats.rejectionReasons[rejectionReason] =
          (stats.rejectionReasons[rejectionReason] || 0) + 1;
      }
      if (quarantined) {
        stats.totalQuarantined++;
      }
    }
  }

  /**
   * Get quality gate summary statistics
   */
  getQualityGateSummary(): {
    totalGates: number;
    activeGates: number;
    totalProcessed: number;
    totalPassed: number;
    totalRejected: number;
    totalQuarantined: number;
    gateStats: Record<string, QualityGateStats>;
  } {
    const allStats = Array.from(this.stats.values());
    const activeGates = Array.from(this.gates.values()).filter((g) => g.enabled).length;

    return {
      totalGates: this.gates.size,
      activeGates,
      totalProcessed: allStats.reduce((sum, s) => sum + s.totalProcessed, 0),
      totalPassed: allStats.reduce((sum, s) => sum + s.totalPassed, 0),
      totalRejected: allStats.reduce((sum, s) => sum + s.totalRejected, 0),
      totalQuarantined: allStats.reduce((sum, s) => sum + s.totalQuarantined, 0),
      gateStats: Object.fromEntries(this.stats),
    };
  }

  /**
   * Calculate priority based on rejection reason
   */
  private calculatePriority(rejectionReason: string): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Payment data with negative amounts (financial risk)
    if (rejectionReason.includes('PAYMENT_AMOUNT_NEGATIVE')) {
      return 'critical';
    }

    // High: Booking data with invalid dates (business impact)
    if (rejectionReason.includes('BOOKING_DATES_INVALID')) {
      return 'high';
    }

    // High: Future event times (data quality issue)
    if (rejectionReason.includes('EVENT_TIME_FUTURE')) {
      return 'high';
    }

    // High: Schema validation with missing required fields
    if (rejectionReason.includes('MISSING_REQUIRED_FIELD')) {
      return 'high';
    }

    // Medium: Schema validation failures
    if (rejectionReason.includes('Schema validation failed')) {
      return 'medium';
    }

    // Medium: Business rules validation failures
    if (rejectionReason.includes('Business rules validation failed')) {
      return 'medium';
    }

    // Low: Default priority
    return 'low';
  }
}
