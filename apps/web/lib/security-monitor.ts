import { supabase } from './supabase';

// Security monitoring configuration
export const SECURITY_CONFIG = {
  ALERT_THRESHOLDS: {
    ATTACK_ATTEMPTS_PER_HOUR: 10,
    RATE_LIMIT_HITS_PER_MINUTE: 5,
    CIRCUIT_BREAKER_TRIPS_PER_HOUR: 3,
  },
  MONITORING_INTERVALS: {
    PATTERN_DETECTION: 5 * 60 * 1000, // 5 minutes
    ALERT_CHECK: 60 * 1000, // 1 minute
    CLEANUP: 24 * 60 * 60 * 1000, // 24 hours
  }
};

// Security event types
export type SecurityEvent = {
  id?: string;
  event_type: 'attack_attempt' | 'rate_limit_hit' | 'circuit_breaker_open' | 'suspicious_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source_ip: string;
  user_agent?: string;
  request_path: string;
  request_method: string;
  attack_pattern?: string;
  confidence_score?: number;
  metadata?: Record<string, any>;
  created_at?: string;
};

// Security alert types
export type SecurityAlert = {
  id?: string;
  alert_type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  related_events: string[];
  metadata?: Record<string, any>;
  created_at?: string;
  acknowledged_at?: string;
  resolved_at?: string;
};

// Security monitoring service
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private monitoringActive = false;
  private intervals: NodeJS.Timeout[] = [];

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  // Log security event to database
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_events')
        .insert([event]);

      if (error) {
        console.error('[SECURITY MONITOR] Failed to log security event:', error);
        // Fallback to console logging
        console.warn('[SECURITY EVENT]', event);
      }
    } catch (error) {
      console.error('[SECURITY MONITOR] Error logging security event:', error);
    }
  }

  // Check for attack patterns and create alerts
  async checkAttackPatterns(): Promise<void> {
    try {
      // Use the database function we created
      const { data: patterns, error } = await supabase.rpc('detect_attack_patterns');

      if (error) {
        console.error('[SECURITY MONITOR] Error checking attack patterns:', error);
        return;
      }

      // Create alerts for detected patterns
      for (const pattern of patterns || []) {
        await this.createSecurityAlert({
          alert_type: 'attack_pattern_detected',
          title: `High Volume Attack Pattern: ${pattern.pattern}`,
          description: `Detected ${pattern.count} attacks of pattern '${pattern.pattern}' in the last hour`,
          severity: 'high',
          status: 'active',
          related_events: [], // Would populate with actual event IDs
          metadata: {
            pattern: pattern.pattern,
            count: pattern.count,
            time_window: '1_hour'
          }
        });
      }
    } catch (error) {
      console.error('[SECURITY MONITOR] Error in checkAttackPatterns:', error);
    }
  }

  // Create security alert
  async createSecurityAlert(alert: Omit<SecurityAlert, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .insert([alert]);

      if (error) {
        console.error('[SECURITY MONITOR] Failed to create security alert:', error);
      } else {
        console.warn('[SECURITY ALERT CREATED]', alert.title);
      }
    } catch (error) {
      console.error('[SECURITY MONITOR] Error creating security alert:', error);
    }
  }

  // Check circuit breaker status and alert if needed
  async checkCircuitBreakerStatus(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: breakerEvents, error } = await supabase
        .from('security_events')
        .select('id')
        .eq('event_type', 'circuit_breaker_open')
        .gte('created_at', oneHourAgo);

      if (error) {
        console.error('[SECURITY MONITOR] Error checking circuit breaker status:', error);
        return;
      }

      const tripCount = breakerEvents?.length || 0;

      if (tripCount >= SECURITY_CONFIG.ALERT_THRESHOLDS.CIRCUIT_BREAKER_TRIPS_PER_HOUR) {
        await this.createSecurityAlert({
          alert_type: 'circuit_breaker_overload',
          title: 'Circuit Breaker Frequent Tripping',
          description: `Circuit breaker has tripped ${tripCount} times in the last hour, indicating potential DoS attack`,
          severity: 'critical',
          status: 'active',
          related_events: [],
          metadata: {
            trip_count: tripCount,
            time_window: '1_hour'
          }
        });
      }
    } catch (error) {
      console.error('[SECURITY MONITOR] Error in checkCircuitBreakerStatus:', error);
    }
  }

  // Check rate limiting patterns
  async checkRateLimitPatterns(): Promise<void> {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

      const { data: rateLimitEvents, error } = await supabase
        .from('security_events')
        .select('source_ip')
        .eq('event_type', 'rate_limit_hit')
        .gte('created_at', oneMinuteAgo);

      if (error) {
        console.error('[SECURITY MONITOR] Error checking rate limit patterns:', error);
        return;
      }

      // Count events by IP
      const ipCounts = new Map<string, number>();
      for (const event of rateLimitEvents || []) {
        const count = ipCounts.get(event.source_ip) || 0;
        ipCounts.set(event.source_ip, count + 1);
      }

      // Create alerts for IPs hitting rate limits frequently
      for (const [ip, count] of ipCounts.entries()) {
        if (count >= SECURITY_CONFIG.ALERT_THRESHOLDS.RATE_LIMIT_HITS_PER_MINUTE) {
          await this.createSecurityAlert({
            alert_type: 'rate_limit_abuse',
            title: `Rate Limit Abuse from IP: ${ip}`,
            description: `IP ${ip} has hit rate limits ${count} times in the last minute`,
            severity: 'medium',
            status: 'active',
            related_events: [],
            metadata: {
              source_ip: ip,
              hit_count: count,
              time_window: '1_minute'
            }
          });
        }
      }
    } catch (error) {
      console.error('[SECURITY MONITOR] Error in checkRateLimitPatterns:', error);
    }
  }

  // Clean up old security events (keep last 7 days)
  async cleanupOldEvents(): Promise<void> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('security_events')
        .delete()
        .lt('created_at', sevenDaysAgo);

      if (error) {
        console.error('[SECURITY MONITOR] Error cleaning up old events:', error);
      } else {
        console.log('[SECURITY MONITOR] Cleaned up old security events');
      }
    } catch (error) {
      console.error('[SECURITY MONITOR] Error in cleanupOldEvents:', error);
    }
  }

  // Start monitoring
  startMonitoring(): void {
    if (this.monitoringActive) {
      console.log('[SECURITY MONITOR] Monitoring already active');
      return;
    }

    console.log('[SECURITY MONITOR] Starting security monitoring...');

    this.monitoringActive = true;

    // Pattern detection every 5 minutes
    this.intervals.push(setInterval(() => {
      this.checkAttackPatterns();
    }, SECURITY_CONFIG.MONITORING_INTERVALS.PATTERN_DETECTION));

    // Alert checks every minute
    this.intervals.push(setInterval(() => {
      this.checkCircuitBreakerStatus();
      this.checkRateLimitPatterns();
    }, SECURITY_CONFIG.MONITORING_INTERVALS.ALERT_CHECK));

    // Cleanup every 24 hours
    this.intervals.push(setInterval(() => {
      this.cleanupOldEvents();
    }, SECURITY_CONFIG.MONITORING_INTERVALS.CLEANUP));
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (!this.monitoringActive) {
      return;
    }

    console.log('[SECURITY MONITOR] Stopping security monitoring...');

    this.monitoringActive = false;
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }

  // Get security statistics
  async getSecurityStats(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<{
    totalEvents: number;
    attackAttempts: number;
    rateLimitHits: number;
    circuitBreakerTrips: number;
    activeAlerts: number;
  }> {
    try {
      const timeRanges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };

      const since = new Date(Date.now() - timeRanges[timeRange]).toISOString();

      const [eventsResult, alertsResult] = await Promise.all([
        supabase
          .from('security_events')
          .select('event_type')
          .gte('created_at', since),
        supabase
          .from('security_alerts')
          .select('status')
          .eq('status', 'active')
      ]);

      if (eventsResult.error || alertsResult.error) {
        throw new Error('Database query failed');
      }

      const events = eventsResult.data || [];
      const alerts = alertsResult.data || [];

      return {
        totalEvents: events.length,
        attackAttempts: events.filter(e => e.event_type === 'attack_attempt').length,
        rateLimitHits: events.filter(e => e.event_type === 'rate_limit_hit').length,
        circuitBreakerTrips: events.filter(e => e.event_type === 'circuit_breaker_open').length,
        activeAlerts: alerts.length
      };
    } catch (error) {
      console.error('[SECURITY MONITOR] Error getting security stats:', error);
      return {
        totalEvents: 0,
        attackAttempts: 0,
        rateLimitHits: 0,
        circuitBreakerTrips: 0,
        activeAlerts: 0
      };
    }
  }
}

// Export singleton instance
export const securityMonitor = SecurityMonitor.getInstance();
