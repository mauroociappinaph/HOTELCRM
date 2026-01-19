-- Security Administration Setup Migration
-- Adds user roles, audit logging, and notification system

-- Extend profiles table with security roles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT ARRAY['basic.read'];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create audit logs table for security actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'email', 'slack', 'sms'
  subject TEXT,
  body TEXT NOT NULL,
  variables TEXT[], -- Array of variable names that can be substituted
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table for sent notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES notification_templates(id),
  recipient VARCHAR(255) NOT NULL, -- email, slack channel, phone number
  subject TEXT,
  body TEXT NOT NULL,
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  metadata JSONB,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create security settings table
CREATE TABLE IF NOT EXISTS security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default security admin user (ciappinamaurooj@gmail.com)
-- Note: This will only work if the user already exists in auth.users
INSERT INTO profiles (id, email, name, role, permissions, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', 'Security Admin') as name,
  'admin',
  ARRAY['security.read', 'security.write', 'security.admin', 'logs.read', 'alerts.manage', 'users.manage', 'system.admin'],
  NOW(),
  NOW()
FROM auth.users au
WHERE au.email = 'ciappinamaurooj@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  permissions = ARRAY['security.read', 'security.write', 'security.admin', 'logs.read', 'alerts.manage', 'users.manage', 'system.admin'],
  updated_at = NOW();

-- Insert default notification templates
INSERT INTO notification_templates (name, type, subject, body, variables) VALUES
('security_alert_critical', 'email',
 '🚨 ALERTA DE SEGURIDAD CRÍTICO - HOTELCRM',
 'Se ha detectado un evento de seguridad crítico:

Tipo: {{alert_type}}
Severidad: {{severity}}
Descripción: {{description}}

Detalles:
{{details}}

Por favor revise inmediatamente el dashboard de seguridad.

Sistema de Seguridad HOTELCRM
Timestamp: {{timestamp}}',
 ARRAY['alert_type', 'severity', 'description', 'details', 'timestamp']),

('security_alert_high', 'email',
 '⚠️ ALERTA DE SEGURIDAD ALTA - HOTELCRM',
 'Se ha detectado un evento de seguridad de alta prioridad:

Tipo: {{alert_type}}
Severidad: {{severity}}
Descripción: {{description}}

Por favor revise el dashboard de seguridad.

Sistema de Seguridad HOTELCRM
Timestamp: {{timestamp}}',
 ARRAY['alert_type', 'severity', 'description', 'timestamp']),

('daily_security_report', 'email',
 '📊 REPORTE DIARIO DE SEGURIDAD - HOTELCRM',
 'Resumen diario de seguridad:

📈 Estadísticas del día:
- Eventos totales: {{total_events}}
- Intentos de ataque: {{attack_attempts}}
- Hits de rate limit: {{rate_limit_hits}}
- Alertas activas: {{active_alerts}}

🚨 Alertas críticas: {{critical_alerts}}

Para más detalles, visite el dashboard de seguridad.

Sistema de Seguridad HOTELCRM
Fecha: {{date}}',
 ARRAY['total_events', 'attack_attempts', 'rate_limit_hits', 'active_alerts', 'critical_alerts', 'date']);

-- Insert default security settings
INSERT INTO security_settings (setting_key, setting_value, description) VALUES
('alert_thresholds', '{
  "attack_attempts_per_hour": 10,
  "rate_limit_hits_per_minute": 5,
  "circuit_breaker_trips_per_hour": 3,
  "critical_alert_cooldown_minutes": 30
}', 'Umbrales para generar alertas automáticas'),

('notification_channels', '{
  "email_enabled": true,
  "slack_enabled": false,
  "sms_enabled": false,
  "email_recipients": ["ciappinamaurooj@gmail.com"],
  "slack_webhook_url": null,
  "daily_report_enabled": true,
  "daily_report_time": "08:00"
}', 'Configuración de canales de notificación'),

('security_features', '{
  "middleware_active": true,
  "monitoring_active": true,
  "auto_blocking_enabled": true,
  "audit_logging_enabled": true,
  "intrusion_detection_enabled": true
}', 'Estado de características de seguridad'),

('rate_limiting', '{
  "window_ms": 900000,
  "max_requests": 100,
  "block_duration_ms": 3600000,
  "whitelist_ips": [],
  "blacklist_ips": []
}', 'Configuración de rate limiting'),

('circuit_breaker', '{
  "failure_threshold": 10,
  "success_threshold": 3,
  "timeout_ms": 60000,
  "monitoring_window_ms": 300000
}', 'Configuración del circuit breaker');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_security_settings_key ON security_settings(setting_key);

-- Update RLS policies for enhanced security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;

-- Policies for audit logs (only admins can read)
CREATE POLICY "Admins can read audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'security_admin')
    )
  );

-- Policies for notifications
CREATE POLICY "Admins can manage notifications" ON notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'security_admin')
    )
  );

-- Policies for security settings
CREATE POLICY "Admins can manage security settings" ON security_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'security_admin')
    )
  );

-- Function to get security settings
CREATE OR REPLACE FUNCTION get_security_setting(setting_key_param VARCHAR(100))
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT setting_value INTO result
  FROM security_settings
  WHERE setting_key = setting_key_param;

  RETURN result;
END;
$$;

-- Function to send security notifications (placeholder for actual implementation)
CREATE OR REPLACE FUNCTION send_security_notification(
  template_name_param VARCHAR(100),
  variables_param JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  template_record RECORD;
  recipient_list TEXT[];
  notification_body TEXT;
  notification_subject TEXT;
BEGIN
  -- Get template
  SELECT * INTO template_record
  FROM notification_templates
  WHERE name = template_name_param AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification template % not found or inactive', template_name_param;
  END IF;

  -- Get recipients based on template type
  SELECT (get_security_setting('notification_channels')->>'email_recipients')::TEXT[] INTO recipient_list;

  IF recipient_list IS NULL OR array_length(recipient_list, 1) = 0 THEN
    -- Fallback to admin users
    SELECT array_agg(email) INTO recipient_list
    FROM profiles
    WHERE role = 'admin' AND email IS NOT NULL;
  END IF;

  -- Process template variables
  notification_body := template_record.body;
  notification_subject := template_record.subject;

  -- Replace variables in body and subject
  FOR i IN 1..array_length(template_record.variables, 1) LOOP
    DECLARE
      var_name TEXT := template_record.variables[i];
      var_value TEXT := variables_param->>var_name;
    BEGIN
      IF var_value IS NOT NULL THEN
        notification_body := replace(notification_body, '{{' || var_name || '}}', var_value);
        IF notification_subject IS NOT NULL THEN
          notification_subject := replace(notification_subject, '{{' || var_name || '}}', var_value);
        END IF;
      END IF;
    END;
  END LOOP;

  -- Insert notifications for each recipient
  FOREACH recipient IN ARRAY recipient_list LOOP
    INSERT INTO notifications (
      template_id,
      recipient,
      subject,
      body,
      type,
      metadata
    ) VALUES (
      template_record.id,
      recipient,
      notification_subject,
      notification_body,
      template_record.type,
      variables_param
    );
  END LOOP;

  -- Log the notification action
  INSERT INTO audit_logs (
    user_id,
    action_type,
    resource_type,
    details,
    ip_address
  ) VALUES (
    auth.uid(),
    'notification_sent',
    'security_system',
    jsonb_build_object(
      'template', template_name_param,
      'recipients', recipient_list,
      'variables', variables_param
    ),
    inet_client_addr()
  );

END;
$$;

-- Function to generate daily security report
CREATE OR REPLACE FUNCTION generate_daily_security_report()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  report_date DATE := CURRENT_DATE - INTERVAL '1 day';
  stats_record RECORD;
BEGIN
  -- Get yesterday's statistics
  SELECT
    COUNT(*) as total_events,
    COUNT(CASE WHEN event_type = 'attack_attempt' THEN 1 END) as attack_attempts,
    COUNT(CASE WHEN event_type = 'rate_limit_hit' THEN 1 END) as rate_limit_hits
  INTO stats_record
  FROM security_events
  WHERE DATE(created_at) = report_date;

  -- Count active alerts
  SELECT COUNT(*) as active_alerts INTO stats_record
  FROM security_alerts
  WHERE status = 'active';

  -- Count critical alerts
  SELECT COUNT(*) as critical_alerts INTO stats_record
  FROM security_alerts
  WHERE status = 'active' AND severity = 'critical';

  -- Send daily report notification
  PERFORM send_security_notification(
    'daily_security_report',
    jsonb_build_object(
      'total_events', stats_record.total_events,
      'attack_attempts', stats_record.attack_attempts,
      'rate_limit_hits', stats_record.rate_limit_hits,
      'active_alerts', stats_record.active_alerts,
      'critical_alerts', stats_record.critical_alerts,
      'date', report_date::TEXT
    )
  );

END;
$$;
