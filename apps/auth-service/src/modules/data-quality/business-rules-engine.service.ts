import { Injectable, Logger } from '@nestjs/common';

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  validate: (record: any, context?: any) => Promise<boolean> | boolean;
  errorMessage: string;
  errorCode: string;
  enabled: boolean;
  metadata?: Record<string, any>;
}

export interface RuleValidationResult {
  ruleId: string;
  passed: boolean;
  errorMessage?: string;
  errorCode?: string;
  executionTime: number;
  metadata?: Record<string, any>;
}

export interface BusinessRulesValidationResult {
  recordId: string;
  overallResult: boolean;
  rulesExecuted: number;
  rulesPassed: number;
  rulesFailed: number;
  ruleResults: RuleValidationResult[];
  executionTime: number;
  failedRules: RuleValidationResult[];
}

@Injectable()
export class BusinessRulesEngineService {
  private readonly logger = new Logger(BusinessRulesEngineService.name);
  private rules = new Map<string, BusinessRule>();
  private rulesByCategory = new Map<string, BusinessRule[]>();

  /**
   * Register a business rule
   */
  registerRule(rule: BusinessRule): void {
    this.rules.set(rule.id, rule);

    // Add to category index
    if (!this.rulesByCategory.has(rule.category)) {
      this.rulesByCategory.set(rule.category, []);
    }
    this.rulesByCategory.get(rule.category)!.push(rule);

    this.logger.log(`📋 Registered business rule: ${rule.name} (${rule.category})`);
  }

  /**
   * Unregister a business rule
   */
  unregisterRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    this.rules.delete(ruleId);

    // Remove from category index
    const categoryRules = this.rulesByCategory.get(rule.category);
    if (categoryRules) {
      const index = categoryRules.findIndex((r) => r.id === ruleId);
      if (index > -1) {
        categoryRules.splice(index, 1);
      }
    }

    this.logger.log(`🗑️ Unregistered business rule: ${ruleId}`);
    return true;
  }

  /**
   * Validate a record against business rules
   */
  async validateRecord(
    record: any,
    recordId: string,
    categories?: string[],
    context?: any,
  ): Promise<BusinessRulesValidationResult> {
    const startTime = Date.now();
    const ruleResults: RuleValidationResult[] = [];
    const failedRules: RuleValidationResult[] = [];

    // Get rules to execute
    let rulesToExecute = Array.from(this.rules.values());

    // Filter by categories if specified
    if (categories && categories.length > 0) {
      rulesToExecute = rulesToExecute.filter((rule) => categories.includes(rule.category));
    }

    // Filter only enabled rules
    rulesToExecute = rulesToExecute.filter((rule) => rule.enabled);

    // Sort by priority (critical first)
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    rulesToExecute.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    // Execute rules
    for (const rule of rulesToExecute) {
      const ruleStartTime = Date.now();
      let passed = false;
      let errorMessage: string | undefined;
      let errorCode: string | undefined;

      try {
        passed = await rule.validate(record, context);

        if (!passed) {
          errorMessage = rule.errorMessage;
          errorCode = rule.errorCode;
        }
      } catch (error) {
        passed = false;
        errorMessage = `Rule execution failed: ${error instanceof Error ? error.message : String(error)}`;
        errorCode = 'RULE_EXECUTION_ERROR';
        this.logger.error(`Business rule ${rule.id} execution failed:`, error);
      }

      const ruleResult: RuleValidationResult = {
        ruleId: rule.id,
        passed,
        errorMessage,
        errorCode,
        executionTime: Date.now() - ruleStartTime,
        metadata: rule.metadata,
      };

      ruleResults.push(ruleResult);

      if (!passed) {
        failedRules.push(ruleResult);
      }
    }

    const executionTime = Date.now() - startTime;
    const overallResult = failedRules.length === 0;

    return {
      recordId,
      overallResult,
      rulesExecuted: rulesToExecute.length,
      rulesPassed: rulesToExecute.length - failedRules.length,
      rulesFailed: failedRules.length,
      ruleResults,
      executionTime,
      failedRules,
    };
  }

  /**
   * Validate multiple records in batch
   */
  async validateRecordsBatch(
    records: Array<{ record: any; recordId: string }>,
    categories?: string[],
    context?: any,
    parallelExecution: boolean = true,
  ): Promise<BusinessRulesValidationResult[]> {
    if (parallelExecution) {
      // Execute in parallel for better performance
      const promises = records.map(({ record, recordId }) =>
        this.validateRecord(record, recordId, categories, context),
      );
      return Promise.all(promises);
    } else {
      // Execute sequentially
      const results: BusinessRulesValidationResult[] = [];
      for (const { record, recordId } of records) {
        const result = await this.validateRecord(record, recordId, categories, context);
        results.push(result);
      }
      return results;
    }
  }

  /**
   * Get all registered rules
   */
  getAllRules(): BusinessRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: string): BusinessRule[] {
    return this.rulesByCategory.get(category) || [];
  }

  /**
   * Get rule by ID
   */
  getRuleById(ruleId: string): BusinessRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    this.logger.log(`${enabled ? '✅ Enabled' : '❌ Disabled'} business rule: ${ruleId}`);
    return true;
  }

  /**
   * Get rules statistics
   */
  getRulesStatistics(): {
    total: number;
    enabled: number;
    disabled: number;
    byCategory: Record<string, { total: number; enabled: number; disabled: number }>;
    byPriority: Record<string, number>;
  } {
    const allRules = Array.from(this.rules.values());
    const enabled = allRules.filter((r) => r.enabled).length;
    const disabled = allRules.length - enabled;

    const byCategory: Record<string, { total: number; enabled: number; disabled: number }> = {};
    const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const rule of allRules) {
      // Category stats
      if (!byCategory[rule.category]) {
        byCategory[rule.category] = { total: 0, enabled: 0, disabled: 0 };
      }
      byCategory[rule.category].total++;
      if (rule.enabled) {
        byCategory[rule.category].enabled++;
      } else {
        byCategory[rule.category].disabled++;
      }

      // Priority stats
      byPriority[rule.priority]++;
    }

    return {
      total: allRules.length,
      enabled,
      disabled,
      byCategory,
      byPriority,
    };
  }

  /**
   * Clear all rules
   */
  clearAllRules(): void {
    this.rules.clear();
    this.rulesByCategory.clear();
    this.logger.log('🧹 Cleared all business rules');
  }

  /**
   * Register HOTELCRM specific business rules
   */
  registerHotelCrmRules(): void {
    // Payment rules
    this.registerRule({
      id: 'payment-amount-positive',
      name: 'Payment Amount Must Be Positive',
      description: 'Payment amounts must be greater than zero',
      priority: 'critical',
      category: 'payments',
      validate: (record) => record.data?.amount > 0,
      errorMessage: 'Payment amount must be positive',
      errorCode: 'PAYMENT_AMOUNT_NEGATIVE',
      enabled: true,
    });

    this.registerRule({
      id: 'payment-currency-valid',
      name: 'Payment Currency Must Be Valid',
      description: 'Payment currency must be supported',
      priority: 'high',
      category: 'payments',
      validate: (record) => ['USD', 'EUR', 'GBP', 'ARS'].includes(record.data?.currency),
      errorMessage: 'Payment currency is not supported',
      errorCode: 'PAYMENT_CURRENCY_INVALID',
      enabled: true,
    });

    // Booking rules
    this.registerRule({
      id: 'booking-dates-valid',
      name: 'Booking Dates Must Be Valid',
      description: 'Check-in date must be before check-out date',
      priority: 'critical',
      category: 'bookings',
      validate: (record) => {
        const checkIn = new Date(record.data?.checkInDate);
        const checkOut = new Date(record.data?.checkOutDate);
        return checkIn < checkOut;
      },
      errorMessage: 'Check-in date must be before check-out date',
      errorCode: 'BOOKING_DATES_INVALID',
      enabled: true,
    });

    this.registerRule({
      id: 'booking-guests-positive',
      name: 'Booking Must Have Positive Guests',
      description: 'Number of guests must be greater than zero',
      priority: 'high',
      category: 'bookings',
      validate: (record) => (record.data?.guests || 0) > 0,
      errorMessage: 'Number of guests must be greater than zero',
      errorCode: 'BOOKING_GUESTS_INVALID',
      enabled: true,
    });

    // Client rules
    this.registerRule({
      id: 'client-email-valid',
      name: 'Client Email Must Be Valid',
      description: 'Client email must have valid format',
      priority: 'high',
      category: 'clients',
      validate: (record) => {
        const email = record.data?.email;
        return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      errorMessage: 'Client email format is invalid',
      errorCode: 'CLIENT_EMAIL_INVALID',
      enabled: true,
    });

    this.registerRule({
      id: 'client-age-valid',
      name: 'Client Age Must Be Valid',
      description: 'Client age must be between 0 and 150',
      priority: 'medium',
      category: 'clients',
      validate: (record) => {
        const age = record.data?.age;
        return age === undefined || (age >= 0 && age <= 150);
      },
      errorMessage: 'Client age must be between 0 and 150',
      errorCode: 'CLIENT_AGE_INVALID',
      enabled: true,
    });

    // General data quality rules
    this.registerRule({
      id: 'event-time-not-future',
      name: 'Event Time Cannot Be In Future',
      description: 'Event timestamp cannot be in the future',
      priority: 'critical',
      category: 'data-quality',
      validate: (record) => {
        const eventTime = new Date(record.eventTime);
        const now = new Date();
        // Allow 5 minutes grace period for clock skew
        return eventTime.getTime() <= now.getTime() + 5 * 60 * 1000;
      },
      errorMessage: 'Event time cannot be in the future',
      errorCode: 'EVENT_TIME_FUTURE',
      enabled: true,
    });

    this.registerRule({
      id: 'event-time-not-too-old',
      name: 'Event Time Not Too Old',
      description: 'Event timestamp cannot be more than 1 year old',
      priority: 'high',
      category: 'data-quality',
      validate: (record) => {
        const eventTime = new Date(record.eventTime);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return eventTime.getTime() >= oneYearAgo.getTime();
      },
      errorMessage: 'Event time cannot be more than 1 year old',
      errorCode: 'EVENT_TIME_TOO_OLD',
      enabled: true,
    });

    this.logger.log('🏨 Registered HOTELCRM business rules');
  }
}
