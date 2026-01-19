-- Migration: 004 - Payments & Stripe Integration
-- Description: Add tables for Stripe payments, subscriptions, and billing management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- STRIPE PRODUCTS & PRICING
-- ===========================================

-- Subscription plans/products
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_product_id TEXT UNIQUE NOT NULL,
    stripe_price_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL, -- Price in cents (e.g., 2999 for $29.99)
    currency TEXT NOT NULL DEFAULT 'usd',
    interval TEXT NOT NULL CHECK (interval IN ('month', 'year')), -- Billing interval
    trial_days INTEGER DEFAULT 0,
    features JSONB DEFAULT '{}', -- Plan features as JSON
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on active plans
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = true;

-- ===========================================
-- CUSTOMER & PAYMENT DATA
-- ===========================================

-- Stripe customers linked to our users
CREATE TABLE stripe_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, agency_id)
);

-- Create indexes for stripe customers
CREATE INDEX idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX idx_stripe_customers_agency_id ON stripe_customers(agency_id);
CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

-- ===========================================
-- SUBSCRIPTIONS
-- ===========================================

-- User subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    stripe_customer_id UUID NOT NULL REFERENCES stripe_customers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,

    stripe_subscription_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    cancel_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, agency_id)
);

-- Create indexes for subscriptions
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_agency_id ON subscriptions(agency_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- ===========================================
-- PAYMENT TRANSACTIONS
-- ===========================================

-- Individual payment records
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    stripe_customer_id UUID NOT NULL REFERENCES stripe_customers(id) ON DELETE CASCADE,

    stripe_payment_intent_id TEXT UNIQUE NOT NULL,
    stripe_charge_id TEXT UNIQUE,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL CHECK (status IN ('succeeded', 'pending', 'failed', 'canceled', 'refunded', 'partially_refunded')),
    payment_method TEXT, -- e.g., 'card', 'bank_transfer'
    description TEXT,

    -- For one-time payments (not subscriptions)
    is_subscription_payment BOOLEAN DEFAULT false,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    failure_code TEXT,
    failure_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for payments
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_agency_id ON payments(agency_id);
CREATE INDEX idx_payments_stripe_intent ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- ===========================================
-- WEBHOOKS & EVENTS
-- ===========================================

-- Stripe webhook events for audit trail
CREATE TABLE stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for webhooks
CREATE INDEX idx_stripe_webhooks_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX idx_stripe_webhooks_type ON stripe_webhook_events(event_type);
CREATE INDEX idx_stripe_webhooks_processed ON stripe_webhook_events(processed);

-- ===========================================
-- INVOICES & BILLING
-- ===========================================

-- Invoices from Stripe
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    stripe_customer_id UUID NOT NULL REFERENCES stripe_customers(id) ON DELETE CASCADE,

    stripe_invoice_id TEXT UNIQUE NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    amount_due_cents INTEGER NOT NULL,
    amount_paid_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'usd',
    invoice_pdf_url TEXT,
    hosted_invoice_url TEXT,

    billing_reason TEXT CHECK (billing_reason IN ('subscription_cycle', 'subscription_create', 'manual', 'upcoming')),
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for invoices
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_agency_id ON invoices(agency_id);
CREATE INDEX idx_invoices_stripe_id ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- ===========================================
-- USAGE TRACKING
-- ===========================================

-- Track usage for metered billing
CREATE TABLE usage_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

    metric_name TEXT NOT NULL, -- e.g., 'ai_tokens', 'bookings', 'storage_gb'
    quantity INTEGER NOT NULL,
    unit TEXT NOT NULL DEFAULT 'count', -- e.g., 'count', 'bytes', 'seconds'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Stripe billing integration
    stripe_meter_event_id TEXT UNIQUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for usage tracking
CREATE INDEX idx_usage_records_user_id ON usage_records(user_id);
CREATE INDEX idx_usage_records_agency_id ON usage_records(agency_id);
CREATE INDEX idx_usage_records_metric ON usage_records(metric_name, timestamp);
CREATE INDEX idx_usage_records_subscription ON usage_records(subscription_id);

-- ===========================================
-- COUPONS & DISCOUNTS
-- ===========================================

-- Coupon codes for discounts
CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_coupon_id TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    name TEXT,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
    discount_value INTEGER NOT NULL, -- Percentage (0-100) or amount in cents
    currency TEXT DEFAULT 'usd',
    max_redemptions INTEGER,
    redemptions_count INTEGER DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for coupons
CREATE INDEX idx_coupons_code ON coupons(code) WHERE is_active = true;
CREATE INDEX idx_coupons_stripe_id ON coupons(stripe_coupon_id);

-- ===========================================
-- RLS POLICIES (Row Level Security)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Policies for subscription_plans (public read for active plans)
CREATE POLICY "Public read access for active subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- Policies for stripe_customers (users can only see their own)
CREATE POLICY "Users can view their own stripe customer data" ON stripe_customers
    FOR SELECT USING (auth.uid() = user_id);

-- Policies for subscriptions (users can only see their own)
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Policies for payments (users can only see their own)
CREATE POLICY "Users can view their own payments" ON payments
    FOR SELECT USING (auth.uid() = user_id);

-- Policies for invoices (users can only see their own)
CREATE POLICY "Users can view their own invoices" ON invoices
    FOR SELECT USING (auth.uid() = user_id);

-- Policies for usage_records (users can only see their own)
CREATE POLICY "Users can view their own usage records" ON usage_records
    FOR SELECT USING (auth.uid() = user_id);

-- Policies for coupons (public read for active coupons)
CREATE POLICY "Public read access for active coupons" ON coupons
    FOR SELECT USING (is_active = true);

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_customers_updated_at
    BEFORE UPDATE ON stripe_customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle subscription status changes
CREATE OR REPLACE FUNCTION handle_subscription_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If subscription is canceled, update canceled_at
    IF NEW.status = 'canceled' AND OLD.status != 'canceled' THEN
        NEW.canceled_at = NOW();
    END IF;

    -- If subscription has ended, update ended_at
    IF NEW.status IN ('canceled', 'unpaid') AND NEW.ended_at IS NULL THEN
        NEW.ended_at = NEW.current_period_end;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for subscription status changes
CREATE TRIGGER subscription_status_change_trigger
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION handle_subscription_status_change();

-- ===========================================
-- INITIAL DATA
-- ===========================================

-- Insert sample subscription plans
INSERT INTO subscription_plans (
    stripe_product_id,
    stripe_price_id,
    name,
    description,
    price_cents,
    currency,
    interval,
    trial_days,
    features
) VALUES
(
    'prod_hotel_basic',
    'price_hotel_basic_monthly',
    'Hotel Basic',
    'Plan básico para hoteles pequeños',
    2999,
    'usd',
    'month',
    14,
    '["Hasta 100 habitaciones", "Sistema de reservas básico", "Soporte por email", "Reportes mensuales"]'::jsonb
),
(
    'prod_hotel_pro',
    'price_hotel_pro_monthly',
    'Hotel Pro',
    'Plan profesional para hoteles medianos',
    5999,
    'usd',
    'month',
    14,
    '["Hasta 500 habitaciones", "Sistema de reservas avanzado", "IA integrada", "Soporte prioritario", "Reportes en tiempo real", "API access"]'::jsonb
),
(
    'prod_hotel_enterprise',
    'price_hotel_enterprise_monthly',
    'Hotel Enterprise',
    'Plan enterprise para cadenas hoteleras',
    14999,
    'usd',
    'month',
    30,
    '["Habitaciones ilimitadas", "Sistema completo de gestión", "IA avanzada", "Soporte 24/7", "Reportes personalizados", "API completa", "Integraciones custom", "Consultoría incluida"]'::jsonb
);

-- Insert sample coupon
INSERT INTO coupons (
    stripe_coupon_id,
    code,
    name,
    description,
    discount_type,
    discount_value,
    max_redemptions,
    valid_until
) VALUES (
    'coupon_welcome_20',
    'WELCOME20',
    'Descuento de bienvenida',
    '20% de descuento en tu primera mensualidad',
    'percent',
    20,
    1000,
    NOW() + INTERVAL '6 months'
);

-- ===========================================
-- VIEWS FOR ANALYTICS
-- ===========================================

-- View for subscription analytics
CREATE VIEW subscription_analytics AS
SELECT
    s.id,
    s.user_id,
    s.agency_id,
    sp.name as plan_name,
    s.status,
    s.current_period_start,
    s.current_period_end,
    sp.price_cents,
    sp.currency,
    sp.interval
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
WHERE s.status IN ('active', 'trialing');

-- View for payment analytics
CREATE VIEW payment_analytics AS
SELECT
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as total_payments,
    SUM(amount_cents) as total_amount_cents,
    AVG(amount_cents) as avg_amount_cents,
    COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful_payments,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
FROM payments
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- View for revenue analytics by agency
CREATE VIEW agency_revenue AS
SELECT
    a.name as agency_name,
    a.id as agency_id,
    COUNT(DISTINCT s.user_id) as active_subscribers,
    SUM(sp.price_cents) as monthly_recurring_revenue_cents,
    AVG(sp.price_cents) as avg_plan_price_cents
FROM agencies a
LEFT JOIN subscriptions s ON a.id = s.agency_id AND s.status = 'active'
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
GROUP BY a.id, a.name;

-- ===========================================
-- MIGRATION COMPLETE
-- ===========================================

-- Add comment to document the migration
COMMENT ON TABLE subscription_plans IS 'Subscription plans/products available for purchase';
COMMENT ON TABLE stripe_customers IS 'Stripe customer records linked to our users';
COMMENT ON TABLE subscriptions IS 'User subscription records with Stripe integration';
COMMENT ON TABLE payments IS 'Individual payment transactions';
COMMENT ON TABLE stripe_webhook_events IS 'Audit trail for Stripe webhook events';
COMMENT ON TABLE invoices IS 'Stripe invoices for billing';
COMMENT ON TABLE usage_records IS 'Usage tracking for metered billing';
COMMENT ON TABLE coupons IS 'Discount coupons and promo codes';
