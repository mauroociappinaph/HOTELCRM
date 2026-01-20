import { Injectable, Logger } from '@nestjs/common';

export interface QualityMetric {
  metricId: string;
  name: string;
  description: string;
  category: 'accuracy' | 'completeness' | 'consistency' | 'timeliness' | 'validity';
  value: number;
  target: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DataQualityScore {
  overallScore: number;
  categoryScores: Record<string, number>;
  metricsCount: number;
  lastUpdated: Date;
  trend: 'improving' | 'declining' | 'stable';
}

export interface QualityReport {
  reportId: string;
  title: string;
  description: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  overallScore: number;
  categoryBreakdown: Record<
    string,
    {
      score: number;
      metricsCount: number;
      failingMetrics: string[];
    }
  >;
  topIssues: Array<{
    metricId: string;
    name: string;
    currentValue: number;
    target: number;
    gap: number;
  }>;
  recommendations: string[];
  rawMetrics: QualityMetric[];
}

@Injectable()
export class QualityMetricsService {
  private readonly logger = new Logger(QualityMetricsService.name);
  private metrics = new Map<string, QualityMetric[]>();
  private metricDefinitions = new Map<string, Omit<QualityMetric, 'value' | 'timestamp'>>();

  /**
   * Register a quality metric definition
   */
  registerMetricDefinition(definition: {
    metricId: string;
    name: string;
    description: string;
    category: QualityMetric['category'];
    target: number;
    unit: string;
    metadata?: Record<string, any>;
  }): void {
    this.metricDefinitions.set(definition.metricId, {
      metricId: definition.metricId,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      target: definition.target,
      unit: definition.unit,
      metadata: definition.metadata,
    });

    this.logger.log(`📊 Registered quality metric: ${definition.name}`);
  }

  /**
   * Record a metric value
   */
  recordMetricValue(metricId: string, value: number, metadata?: Record<string, any>): void {
    const definition = this.metricDefinitions.get(metricId);
    if (!definition) {
      this.logger.warn(`Metric definition not found: ${metricId}`);
      return;
    }

    const metric: QualityMetric = {
      ...definition,
      value,
      timestamp: new Date(),
      metadata,
    };

    if (!this.metrics.has(metricId)) {
      this.metrics.set(metricId, []);
    }

    // Keep only last 1000 values for memory management
    const values = this.metrics.get(metricId)!;
    values.push(metric);
    if (values.length > 1000) {
      values.shift();
    }

    // Log significant deviations from target
    const deviation = Math.abs(value - definition.target) / definition.target;
    if (deviation > 0.1) {
      // More than 10% deviation
      const direction = value > definition.target ? 'above' : 'below';
      this.logger.warn(
        `⚠️ Quality metric alert: ${definition.name} is ${deviation.toFixed(2)} ${direction} target (${value} vs ${definition.target})`,
      );
    }
  }

  /**
   * Get current metric value
   */
  getCurrentMetricValue(metricId: string): QualityMetric | undefined {
    const values = this.metrics.get(metricId);
    return values && values.length > 0 ? values[values.length - 1] : undefined;
  }

  /**
   * Get metric history
   */
  getMetricHistory(metricId: string, limit: number = 100): QualityMetric[] {
    const values = this.metrics.get(metricId);
    if (!values) return [];

    return values.slice(-limit);
  }

  /**
   * Calculate overall data quality score
   */
  calculateQualityScore(): DataQualityScore {
    const allMetrics = Array.from(this.metrics.values()).flat();
    if (allMetrics.length === 0) {
      return {
        overallScore: 0,
        categoryScores: {},
        metricsCount: 0,
        lastUpdated: new Date(),
        trend: 'stable',
      };
    }

    // Group by category
    const categoryMetrics = new Map<string, QualityMetric[]>();
    for (const metric of allMetrics) {
      if (!categoryMetrics.has(metric.category)) {
        categoryMetrics.set(metric.category, []);
      }
      categoryMetrics.get(metric.category)!.push(metric);
    }

    // Calculate category scores
    const categoryScores: Record<string, number> = {};
    for (const [category, metrics] of categoryMetrics) {
      const categoryScore = this.calculateCategoryScore(metrics);
      categoryScores[category] = categoryScore;
    }

    // Overall score is weighted average of categories
    const categories = Object.keys(categoryScores);
    const overallScore =
      categories.length > 0
        ? categories.reduce((sum, cat) => sum + categoryScores[cat], 0) / categories.length
        : 0;

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      categoryScores,
      metricsCount: allMetrics.length,
      lastUpdated: new Date(),
      trend: this.calculateTrend(allMetrics),
    };
  }

  /**
   * Generate comprehensive quality report
   */
  generateQualityReport(
    title: string = 'Data Quality Report',
    description: string = 'Comprehensive data quality assessment',
    daysBack: number = 30,
  ): QualityReport {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get metrics from the period
    const relevantMetrics = this.getMetricsInPeriod(startDate, endDate);

    // Calculate current scores
    const qualityScore = this.calculateQualityScore();

    // Group by category
    const categoryBreakdown: Record<
      string,
      {
        score: number;
        metricsCount: number;
        failingMetrics: string[];
      }
    > = {};

    const categoryMetrics = new Map<string, QualityMetric[]>();
    for (const metric of relevantMetrics) {
      if (!categoryMetrics.has(metric.category)) {
        categoryMetrics.set(metric.category, []);
      }
      categoryMetrics.get(metric.category)!.push(metric);
    }

    // Calculate category breakdown
    for (const [category, metrics] of categoryMetrics) {
      const categoryScore = this.calculateCategoryScore(metrics);
      const failingMetrics = metrics
        .filter((m) => m.value < m.target * 0.9) // Below 90% of target
        .map((m) => m.name);

      categoryBreakdown[category] = {
        score: Math.round(categoryScore * 100) / 100,
        metricsCount: metrics.length,
        failingMetrics,
      };
    }

    // Find top issues
    const topIssues = relevantMetrics
      .map((metric) => ({
        metricId: metric.metricId,
        name: metric.name,
        currentValue: metric.value,
        target: metric.target,
        gap: metric.target - metric.value,
      }))
      .filter((issue) => issue.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 10);

    // Generate recommendations
    const recommendations = this.generateRecommendations(topIssues, categoryBreakdown);

    return {
      reportId: `report-${Date.now()}`,
      title,
      description,
      generatedAt: new Date(),
      period: {
        start: startDate,
        end: endDate,
      },
      overallScore: qualityScore.overallScore,
      categoryBreakdown,
      topIssues,
      recommendations,
      rawMetrics: relevantMetrics,
    };
  }

  /**
   * Register HOTELCRM quality metrics
   */
  registerHotelCrmMetrics(): void {
    // Accuracy metrics
    this.registerMetricDefinition({
      metricId: 'booking-accuracy',
      name: 'Booking Data Accuracy',
      description: 'Percentage of booking records with accurate data',
      category: 'accuracy',
      target: 98,
      unit: 'percentage',
    });

    this.registerMetricDefinition({
      metricId: 'payment-accuracy',
      name: 'Payment Data Accuracy',
      description: 'Percentage of payment records with accurate data',
      category: 'accuracy',
      target: 99.5,
      unit: 'percentage',
    });

    this.registerMetricDefinition({
      metricId: 'client-accuracy',
      name: 'Client Data Accuracy',
      description: 'Percentage of client records with accurate data',
      category: 'accuracy',
      target: 95,
      unit: 'percentage',
    });

    // Completeness metrics
    this.registerMetricDefinition({
      metricId: 'booking-completeness',
      name: 'Booking Data Completeness',
      description: 'Percentage of required booking fields filled',
      category: 'completeness',
      target: 95,
      unit: 'percentage',
    });

    this.registerMetricDefinition({
      metricId: 'payment-completeness',
      name: 'Payment Data Completeness',
      description: 'Percentage of required payment fields filled',
      category: 'completeness',
      target: 98,
      unit: 'percentage',
    });

    this.registerMetricDefinition({
      metricId: 'client-completeness',
      name: 'Client Data Completeness',
      description: 'Percentage of required client fields filled',
      category: 'completeness',
      target: 90,
      unit: 'percentage',
    });

    // Consistency metrics
    this.registerMetricDefinition({
      metricId: 'cross-table-consistency',
      name: 'Cross-Table Data Consistency',
      description: 'Consistency between related tables (bookings-payments)',
      category: 'consistency',
      target: 96,
      unit: 'percentage',
    });

    this.registerMetricDefinition({
      metricId: 'enum-consistency',
      name: 'Enum Value Consistency',
      description: 'Consistency of enum values across records',
      category: 'consistency',
      target: 99,
      unit: 'percentage',
    });

    // Timeliness metrics
    this.registerMetricDefinition({
      metricId: 'data-freshness',
      name: 'Data Freshness',
      description: 'Average age of data records',
      category: 'timeliness',
      target: 24, // hours
      unit: 'hours',
    });

    this.registerMetricDefinition({
      metricId: 'late-arrival-rate',
      name: 'Late Arrival Rate',
      description: 'Percentage of records arriving late',
      category: 'timeliness',
      target: 2, // percentage
      unit: 'percentage',
    });

    // Validity metrics
    this.registerMetricDefinition({
      metricId: 'schema-compliance',
      name: 'Schema Compliance',
      description: 'Percentage of records complying with schema',
      category: 'validity',
      target: 97,
      unit: 'percentage',
    });

    this.registerMetricDefinition({
      metricId: 'business-rule-compliance',
      name: 'Business Rule Compliance',
      description: 'Percentage of records passing business rules',
      category: 'validity',
      target: 94,
      unit: 'percentage',
    });

    this.logger.log('📊 Registered HOTELCRM quality metrics');
  }

  /**
   * Update metric from quality gate results
   */
  updateMetricsFromGateResults(gateResults: any[]): void {
    // Schema compliance
    const totalRecords = gateResults.length;
    const schemaCompliant = gateResults.filter(
      (r) => r.checks?.schemaValidation?.isValid !== false,
    ).length;
    const schemaComplianceRate = totalRecords > 0 ? (schemaCompliant / totalRecords) * 100 : 100;

    this.recordMetricValue('schema-compliance', schemaComplianceRate);

    // Business rule compliance
    const businessRulesCompliant = gateResults.filter(
      (r) => r.checks?.businessRulesValidation?.overallResult !== false,
    ).length;
    const businessRulesComplianceRate =
      totalRecords > 0 ? (businessRulesCompliant / totalRecords) * 100 : 100;

    this.recordMetricValue('business-rule-compliance', businessRulesComplianceRate);

    // Late arrival rate (from event time analysis)
    const lateRecords = gateResults.filter((r) => r.rejectedReason?.includes('late')).length;
    const lateArrivalRate = totalRecords > 0 ? (lateRecords / totalRecords) * 100 : 0;

    this.recordMetricValue('late-arrival-rate', lateArrivalRate);
  }

  /**
   * Calculate category score from metrics
   */
  private calculateCategoryScore(metrics: QualityMetric[]): number {
    if (metrics.length === 0) return 0;

    // Weighted average based on how close each metric is to its target
    const weightedScores = metrics.map((metric) => {
      const distance = Math.abs(metric.value - metric.target);
      const maxDistance = Math.max(metric.target, Math.abs(metric.value - metric.target));

      // Score from 0-1, where 1 means exactly on target
      return maxDistance === 0 ? 1 : Math.max(0, 1 - distance / maxDistance);
    });

    return weightedScores.reduce((sum, score) => sum + score, 0) / weightedScores.length;
  }

  /**
   * Calculate trend from metrics
   */
  private calculateTrend(metrics: QualityMetric[]): 'improving' | 'declining' | 'stable' {
    if (metrics.length < 2) return 'stable';

    // Sort by timestamp and take last 10 metrics
    const recentMetrics = metrics
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    // Calculate average of first half vs second half
    const midPoint = Math.floor(recentMetrics.length / 2);
    const firstHalf = recentMetrics.slice(0, midPoint);
    const secondHalf = recentMetrics.slice(midPoint);

    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;

    const change = secondHalfAvg - firstHalfAvg;
    const threshold = Math.abs(firstHalfAvg * 0.05); // 5% change threshold

    if (change > threshold) return 'improving';
    if (change < -threshold) return 'declining';
    return 'stable';
  }

  /**
   * Get metrics within a time period
   */
  private getMetricsInPeriod(startDate: Date, endDate: Date): QualityMetric[] {
    const result: QualityMetric[] = [];

    for (const metrics of this.metrics.values()) {
      for (const metric of metrics) {
        if (metric.timestamp >= startDate && metric.timestamp <= endDate) {
          result.push(metric);
        }
      }
    }

    return result;
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(
    topIssues: Array<{
      metricId: string;
      name: string;
      currentValue: number;
      target: number;
      gap: number;
    }>,
    categoryBreakdown: Record<
      string,
      { score: number; metricsCount: number; failingMetrics: string[] }
    >,
  ): string[] {
    const recommendations: string[] = [];

    // General recommendations based on overall score
    const overallScore =
      Object.values(categoryBreakdown).reduce((sum, cat) => sum + cat.score, 0) /
      Object.keys(categoryBreakdown).length;

    if (overallScore < 0.8) {
      recommendations.push(
        'Overall data quality is below acceptable levels. Implement immediate data quality improvement measures.',
      );
    }

    // Category-specific recommendations
    for (const [category, breakdown] of Object.entries(categoryBreakdown)) {
      if (breakdown.score < 0.85) {
        switch (category) {
          case 'accuracy':
            recommendations.push(
              'Improve data accuracy by implementing stricter validation rules and data profiling.',
            );
            break;
          case 'completeness':
            recommendations.push(
              'Address data completeness issues by making required fields mandatory and providing better data collection forms.',
            );
            break;
          case 'consistency':
            recommendations.push(
              'Fix data consistency problems by implementing cross-table validation and referential integrity checks.',
            );
            break;
          case 'timeliness':
            recommendations.push(
              'Improve data timeliness by optimizing data pipelines and reducing processing latency.',
            );
            break;
          case 'validity':
            recommendations.push(
              'Enhance data validity by updating schemas and business rules to reflect current requirements.',
            );
            break;
        }
      }
    }

    // Specific recommendations for failing metrics
    for (const issue of topIssues.slice(0, 3)) {
      if (issue.metricId.includes('schema')) {
        recommendations.push(
          `Update data schemas and validation rules to address ${issue.name} issues.`,
        );
      } else if (issue.metricId.includes('business-rule')) {
        recommendations.push(
          `Review and update business rules to improve ${issue.name} compliance.`,
        );
      } else if (issue.metricId.includes('freshness')) {
        recommendations.push('Optimize data pipelines to reduce data freshness issues.');
      }
    }

    // Add general best practices
    recommendations.push('Implement automated data quality monitoring and alerting.');
    recommendations.push('Establish data stewardship roles for ongoing quality management.');
    recommendations.push('Create data quality dashboards for continuous monitoring.');

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Get all metric definitions
   */
  getAllMetricDefinitions(): Array<Omit<QualityMetric, 'value' | 'timestamp'>> {
    return Array.from(this.metricDefinitions.values());
  }

  /**
   * Get metric statistics
   */
  getMetricStatistics(metricId: string):
    | {
        current: QualityMetric | undefined;
        average: number;
        min: number;
        max: number;
        trend: 'improving' | 'declining' | 'stable';
        dataPoints: number;
      }
    | undefined {
    const values = this.metrics.get(metricId);
    if (!values || values.length === 0) return undefined;

    const current = values[values.length - 1];
    const numericValues = values.map((v) => v.value);

    return {
      current,
      average: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length,
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
      trend: this.calculateTrend(values),
      dataPoints: values.length,
    };
  }

  /**
   * Export metrics data for external analysis
   */
  exportMetricsData(): {
    definitions: Array<Omit<QualityMetric, 'value' | 'timestamp'>>;
    data: Record<string, QualityMetric[]>;
    summary: DataQualityScore;
  } {
    return {
      definitions: Array.from(this.metricDefinitions.values()),
      data: Object.fromEntries(this.metrics),
      summary: this.calculateQualityScore(),
    };
  }
}
