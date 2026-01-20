import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface SecurityUser {
  id: string;
  email: string;
  role: 'admin' | 'security_admin' | 'user';
  permissions: string[];
  last_login?: string;
  created_at: string;
}

export interface SecurityAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  metadata?: Record<string, any>;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  acknowledged_by?: string;
  resolved_by?: string;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // Create admin user with specific email
  async createAdminUser(email: string, name: string): Promise<SecurityUser> {
    try {
      // Check if user already exists
      const { data: existingUser } = await this.supabaseService
        .getClient()
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (existingUser) {
        // Update existing user to admin
        const { data, error } = await this.supabaseService
          .getClient()
          .from('profiles')
          .update({
            role: 'admin',
            permissions: [
              'security.read',
              'security.write',
              'security.admin',
              'logs.read',
              'alerts.manage',
            ],
            updated_at: new Date().toISOString(),
          })
          .eq('email', email)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      // Create new admin user
      const { data, error } = await this.supabaseService
        .getClient()
        .from('profiles')
        .insert({
          email,
          name,
          role: 'admin',
          permissions: [
            'security.read',
            'security.write',
            'security.admin',
            'logs.read',
            'alerts.manage',
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      this.logger.log(`Admin user created: ${email}`);
      return data;
    } catch (error) {
      this.logger.error(`Failed to create admin user: ${email}`, error);
      throw error;
    }
  }

  // Get all security users
  async getSecurityUsers(): Promise<SecurityUser[]> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'security_admin'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      this.logger.error('Failed to get security users', error);
      throw error;
    }
  }

  // Get security events with advanced filtering
  async getSecurityEvents(
    filters: {
      limit?: number;
      offset?: number;
      severity?: string;
      event_type?: string;
      date_from?: string;
      date_to?: string;
    } = {},
  ): Promise<any[]> {
    try {
      let query = this.supabaseService
        .getClient()
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.severity) {
        query = query.eq('severity', filters.severity);
      }

      if (filters.event_type) {
        query = query.eq('event_type', filters.event_type);
      }

      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get security events', error);
      throw error;
    }
  }

  // Get security alerts
  async getSecurityAlerts(status?: string): Promise<SecurityAlert[]> {
    try {
      let query = this.supabaseService
        .getClient()
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      this.logger.error('Failed to get security alerts', error);
      throw error;
    }
  }

  // Update alert status
  async updateAlertStatus(alertId: string, status: string, userId: string): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'acknowledged') {
        updateData.acknowledged_at = new Date().toISOString();
        updateData.acknowledged_by = userId;
      } else if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = userId;
      }

      const { error } = await this.supabaseService
        .getClient()
        .from('security_alerts')
        .update(updateData)
        .eq('id', alertId);

      if (error) throw error;

      this.logger.log(`Alert ${alertId} updated to status: ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update alert ${alertId}`, error);
      throw error;
    }
  }

  // Get security dashboard statistics
  async getSecurityDashboardStats(): Promise<{
    totalEvents: number;
    activeAlerts: number;
    criticalAlerts: number;
    attackAttemptsToday: number;
    rateLimitHitsToday: number;
    circuitBreakerTripsToday: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const [eventsResult, alertsResult, todayEventsResult] = await Promise.all([
        // Total events count
        this.supabaseService.getClient().from('security_events').select('id', { count: 'exact' }),
        // Active alerts
        this.supabaseService
          .getClient()
          .from('security_alerts')
          .select('id, severity')
          .eq('status', 'active'),
        // Today's events
        this.supabaseService
          .getClient()
          .from('security_events')
          .select('event_type')
          .gte('created_at', todayStr),
      ]);

      const totalEvents = eventsResult.count || 0;
      const activeAlerts = alertsResult.data || [];
      const todayEvents = todayEventsResult.data || [];

      return {
        totalEvents,
        activeAlerts: activeAlerts.length,
        criticalAlerts: activeAlerts.filter((a) => a.severity === 'critical').length,
        attackAttemptsToday: todayEvents.filter((e) => e.event_type === 'attack_attempt').length,
        rateLimitHitsToday: todayEvents.filter((e) => e.event_type === 'rate_limit_hit').length,
        circuitBreakerTripsToday: todayEvents.filter((e) => e.event_type === 'circuit_breaker_open')
          .length,
      };
    } catch (error) {
      this.logger.error('Failed to get security dashboard stats', error);
      throw error;
    }
  }

  // Send security alert notification (placeholder for email/Slack integration)
  async sendAlertNotification(alert: SecurityAlert): Promise<void> {
    try {
      // TODO: Implement actual email/Slack notifications
      // For now, just log the alert
      this.logger.warn(`SECURITY ALERT: ${alert.title}`, {
        severity: alert.severity,
        description: alert.description,
        metadata: alert.metadata,
      });

      // Placeholder for external notifications:
      // - Email service integration
      // - Slack webhook
      // - SMS notifications for critical alerts
      // - Push notifications
    } catch (error) {
      this.logger.error('Failed to send alert notification', error);
      throw error;
    }
  }

  // Audit log for security actions
  async logSecurityAction(action: {
    user_id: string;
    action_type: string;
    resource_type: string;
    resource_id?: string;
    details?: Record<string, any>;
    ip_address?: string;
  }): Promise<void> {
    try {
      const { error } = await this.supabaseService.getClient().from('audit_logs').insert({
        user_id: action.user_id,
        action_type: action.action_type,
        resource_type: action.resource_type,
        resource_id: action.resource_id,
        details: action.details,
        ip_address: action.ip_address,
        created_at: new Date().toISOString(),
      });

      if (error) {
        // If audit_logs table doesn't exist yet, just log to console
        this.logger.log(
          `AUDIT: ${action.action_type} by ${action.user_id} on ${action.resource_type}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to log security action', error);
    }
  }
}
