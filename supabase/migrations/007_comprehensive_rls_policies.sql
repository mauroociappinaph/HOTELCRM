-- Migration: 007 - Comprehensive RLS Policies Implementation
-- Description: Implement Row Level Security policies for complete multi-tenant data isolation
-- Date: 2026-01-20
-- Critical Security Update: Ensures users can only access data from their agency

-- ===========================================
-- HELPER FUNCTIONS FOR RLS
-- ===========================================

-- Function to get current user's agency_id from profiles table
CREATE OR REPLACE FUNCTION auth.agency_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT agency_id FROM profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::UUID
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM profiles WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Function to check if current user belongs to agency
CREATE OR REPLACE FUNCTION auth.belongs_to_agency(target_agency_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT agency_id = target_agency_id FROM profiles WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ===========================================
-- ENABLE RLS ON ALL TABLES
-- ===========================================

-- Core business tables
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;

-- Extended business tables
ALTER TABLE tax_perceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Payment tables (RLS already enabled in migration 004, but policies need updating)
-- ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY; -- Already enabled
-- ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY; -- Already enabled
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY; -- Already enabled
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY; -- Already enabled
-- ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY; -- Already enabled
-- ALTER TABLE invoices ENABLE ROW LEVEL SECURITY; -- Already enabled
-- ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY; -- Already enabled
-- ALTER TABLE coupons ENABLE ROW LEVEL SECURITY; -- Already enabled

-- ===========================================
-- DROP EXISTING POLICIES (to avoid conflicts)
-- ===========================================

-- Core business tables
DROP POLICY IF EXISTS "Users can view agencies they belong to" ON agencies;
DROP POLICY IF EXISTS "Admins can manage agencies" ON agencies;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view clients in their agency" ON clients;
DROP POLICY IF EXISTS "Users can manage clients in their agency" ON clients;
DROP POLICY IF EXISTS "Users can view itineraries in their agency" ON itineraries;
DROP POLICY IF EXISTS "Users can manage itineraries in their agency" ON itineraries;
DROP POLICY IF EXISTS "Users can view bookings in their agency" ON bookings;
DROP POLICY IF EXISTS "Users can manage bookings in their agency" ON bookings;
DROP POLICY IF EXISTS "Users can view document sections in their agency" ON document_sections;
DROP POLICY IF EXISTS "Users can manage document sections in their agency" ON document_sections;

-- Extended business tables
DROP POLICY IF EXISTS "Users can view tax perceptions in their agency" ON tax_perceptions;
DROP POLICY IF EXISTS "Users can manage tax perceptions in their agency" ON tax_perceptions;
DROP POLICY IF EXISTS "Users can view AI knowledge base in their agency" ON ai_knowledge_base;
DROP POLICY IF EXISTS "Users can manage AI knowledge base in their agency" ON ai_knowledge_base;
DROP POLICY IF EXISTS "Users can view video sessions in their agency" ON video_sessions;
DROP POLICY IF EXISTS "Users can manage video sessions in their agency" ON video_sessions;
DROP POLICY IF EXISTS "Users can view transactions in their agency" ON transactions;
DROP POLICY IF EXISTS "Users can manage transactions in their agency" ON transactions;

-- Payment tables (drop existing policies to recreate properly)
DROP POLICY IF EXISTS "Public read access for active subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Users can view their own stripe customer data" ON stripe_customers;
DROP POLICY IF EXISTS "Users can manage their own stripe customer data" ON stripe_customers;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
DROP POLICY IF EXISTS "Users can manage their own payments" ON payments;
DROP POLICY IF EXISTS "Service role can manage webhook events" ON stripe_webhook_events;
DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can manage their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view their own usage records" ON usage_records;
DROP POLICY IF EXISTS "Users can manage their own usage records" ON usage_records;
DROP POLICY IF EXISTS "Public read access for active coupons" ON coupons;

-- ===========================================
-- RLS POLICIES FOR CORE BUSINESS TABLES
-- ===========================================

-- AGENCIES: Users can only see/modify agencies they belong to, admins can manage all
CREATE POLICY "Users can view agencies they belong to" ON agencies
    FOR SELECT USING (
        auth.belongs_to_agency(id) OR
        auth.is_admin()
    );

CREATE POLICY "Admins can manage agencies" ON agencies
    FOR ALL USING (auth.is_admin())
    WITH CHECK (auth.is_admin());

-- PROFILES: Users can only see/modify their own profile
CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- CLIENTS: Users can only access clients in their agency
CREATE POLICY "Users can view clients in their agency" ON clients
    FOR SELECT USING (auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage clients in their agency" ON clients
    FOR ALL USING (auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.belongs_to_agency(agency_id));

-- ITINERARIES: Users can only access itineraries in their agency
CREATE POLICY "Users can view itineraries in their agency" ON itineraries
    FOR SELECT USING (auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage itineraries in their agency" ON itineraries
    FOR ALL USING (auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.belongs_to_agency(agency_id));

-- BOOKINGS: Users can only access bookings in their agency
CREATE POLICY "Users can view bookings in their agency" ON bookings
    FOR SELECT USING (auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage bookings in their agency" ON bookings
    FOR ALL USING (auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.belongs_to_agency(agency_id));

-- DOCUMENT SECTIONS: Users can only access document sections in their agency
CREATE POLICY "Users can view document sections in their agency" ON document_sections
    FOR SELECT USING (
        agency_id IS NULL OR
        auth.belongs_to_agency(agency_id)
    );

CREATE POLICY "Users can manage document sections in their agency" ON document_sections
    FOR ALL USING (
        agency_id IS NULL OR
        auth.belongs_to_agency(agency_id)
    )
    WITH CHECK (
        agency_id IS NULL OR
        auth.belongs_to_agency(agency_id)
    );

-- ===========================================
-- RLS POLICIES FOR EXTENDED BUSINESS TABLES
-- ===========================================

-- TAX PERCEPTIONS: Users can only access tax perceptions for bookings in their agency
CREATE POLICY "Users can view tax perceptions in their agency" ON tax_perceptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = tax_perceptions.booking_id
            AND auth.belongs_to_agency(b.agency_id)
        )
    );

CREATE POLICY "Users can manage tax perceptions in their agency" ON tax_perceptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = tax_perceptions.booking_id
            AND auth.belongs_to_agency(b.agency_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = tax_perceptions.booking_id
            AND auth.belongs_to_agency(b.agency_id)
        )
    );

-- AI KNOWLEDGE BASE: Users can only access knowledge base in their agency
CREATE POLICY "Users can view AI knowledge base in their agency" ON ai_knowledge_base
    FOR SELECT USING (auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage AI knowledge base in their agency" ON ai_knowledge_base
    FOR ALL USING (auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.belongs_to_agency(agency_id));

-- VIDEO SESSIONS: Users can only access video sessions in their agency
CREATE POLICY "Users can view video sessions in their agency" ON video_sessions
    FOR SELECT USING (auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage video sessions in their agency" ON video_sessions
    FOR ALL USING (auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.belongs_to_agency(agency_id));

-- TRANSACTIONS: Users can only access transactions in their agency
CREATE POLICY "Users can view transactions in their agency" ON transactions
    FOR SELECT USING (auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage transactions in their agency" ON transactions
    FOR ALL USING (auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.belongs_to_agency(agency_id));

-- ===========================================
-- UPDATED RLS POLICIES FOR PAYMENT TABLES
-- ===========================================

-- SUBSCRIPTION PLANS: Public read for active plans (no agency restriction needed)
CREATE POLICY "Public read access for active subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- STRIPE CUSTOMERS: Users can only access their own stripe customer data
CREATE POLICY "Users can view their own stripe customer data" ON stripe_customers
    FOR SELECT USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage their own stripe customer data" ON stripe_customers
    FOR ALL USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

-- SUBSCRIPTIONS: Users can only access their own subscriptions
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage their own subscriptions" ON subscriptions
    FOR ALL USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

-- PAYMENTS: Users can only access their own payments
CREATE POLICY "Users can view their own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage their own payments" ON payments
    FOR ALL USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

-- STRIPE WEBHOOK EVENTS: Only service role can manage (security events)
CREATE POLICY "Service role can manage webhook events" ON stripe_webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- INVOICES: Users can only access their own invoices
CREATE POLICY "Users can view their own invoices" ON invoices
    FOR SELECT USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage their own invoices" ON invoices
    FOR ALL USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

-- USAGE RECORDS: Users can only access their own usage records
CREATE POLICY "Users can view their own usage records" ON usage_records
    FOR SELECT USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

CREATE POLICY "Users can manage their own usage records" ON usage_records
    FOR ALL USING (auth.uid() = user_id AND auth.belongs_to_agency(agency_id))
    WITH CHECK (auth.uid() = user_id AND auth.belongs_to_agency(agency_id));

-- COUPONS: Public read for active coupons (no agency restriction needed)
CREATE POLICY "Public read access for active coupons" ON coupons
    FOR SELECT USING (is_active = true);

-- ===========================================
-- SECURITY AUDIT LOGGING
-- ===========================================

-- Create audit log table for security events
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    table_name TEXT NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view security audit logs" ON security_audit_log
    FOR SELECT USING (auth.is_admin());

-- Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs" ON security_audit_log
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ===========================================
-- PERFORMANCE INDEXES FOR RLS
-- ===========================================

-- Ensure indexes exist for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_clients_agency_id ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_agency_id ON itineraries(agency_id);
CREATE INDEX IF NOT EXISTS idx_bookings_agency_id ON bookings(agency_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_agency_id ON document_sections(agency_id);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_agency_id ON ai_knowledge_base(agency_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_agency_id ON video_sessions(agency_id);
CREATE INDEX IF NOT EXISTS idx_transactions_agency_id ON transactions(agency_id);

-- Composite indexes for user + agency access patterns
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_agency ON stripe_customers(user_id, agency_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_agency ON subscriptions(user_id, agency_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_agency ON payments(user_id, agency_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_agency ON invoices(user_id, agency_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_agency ON usage_records(user_id, agency_id);

-- ===========================================
-- VALIDATION FUNCTIONS
-- ===========================================

-- Function to validate agency access for data operations
CREATE OR REPLACE FUNCTION validate_agency_access(target_agency_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_agency_id UUID;
BEGIN
    -- Get current user's agency
    SELECT agency_id INTO user_agency_id
    FROM profiles
    WHERE id = auth.uid();

    -- Check if user belongs to target agency or is admin
    RETURN user_agency_id = target_agency_id OR
           EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- MIGRATION COMPLETE
-- ===========================================

-- Add comments documenting the security implementation
COMMENT ON FUNCTION auth.agency_id() IS 'Returns the agency_id of the current authenticated user';
COMMENT ON FUNCTION auth.is_admin() IS 'Returns true if the current user has admin role';
COMMENT ON FUNCTION auth.belongs_to_agency(UUID) IS 'Returns true if current user belongs to the specified agency';
COMMENT ON FUNCTION validate_agency_access(UUID) IS 'Validates if user has access to specified agency data';

COMMENT ON TABLE security_audit_log IS 'Audit log for security-related events and data access';

-- Log the completion of RLS implementation
DO $$
BEGIN
    RAISE NOTICE 'Comprehensive RLS policies implemented successfully. All tables now have proper multi-tenant data isolation.';
END $$;
