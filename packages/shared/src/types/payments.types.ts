export interface SubscriptionPlan {
  id: string;
  stripeProductId: string;
  stripePriceId: string;
  name: string;
  description?: string;
  priceCents: number;
  currency: string;
  interval: 'month' | 'year';
  trialDays: number;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StripeCustomer {
  id: string;
  userId: string;
  agencyId: string;
  stripeCustomerId: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  agencyId: string;
  stripeCustomerId: string;
  planId: string;
  plan?: SubscriptionPlan;
  stripeSubscriptionId: string;
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAt?: Date;
  canceledAt?: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  userId: string;
  agencyId: string;
  stripeCustomerId: string;
  stripePaymentIntentId: string;
  stripeChargeId?: string;
  amountCents: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'canceled' | 'refunded' | 'partially_refunded';
  paymentMethod?: string;
  description?: string;
  isSubscriptionPayment: boolean;
  subscriptionId?: string;
  metadata?: Record<string, any>;
  failureCode?: string;
  failureMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  agencyId: string;
  stripeCustomerId: string;
  stripeInvoiceId: string;
  subscriptionId?: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  invoicePdfUrl?: string;
  hostedInvoiceUrl?: string;
  billingReason?: 'subscription_cycle' | 'subscription_create' | 'manual' | 'upcoming';
  periodStart?: Date;
  periodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageRecord {
  id: string;
  userId: string;
  agencyId: string;
  subscriptionId?: string;
  metricName: string;
  quantity: number;
  unit: string;
  timestamp: Date;
  stripeMeterEventId?: string;
  createdAt: Date;
}

export interface Coupon {
  id: string;
  stripeCouponId: string;
  code: string;
  name?: string;
  description?: string;
  discountType: 'percent' | 'amount';
  discountValue: number;
  currency?: string;
  maxRedemptions?: number;
  redemptionsCount: number;
  validFrom?: Date;
  validUntil?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateSubscriptionRequest {
  planId: string;
  couponCode?: string;
}

export interface CancelSubscriptionRequest {
  cancelAtPeriodEnd?: boolean;
}

export interface ApplyCouponRequest {
  couponCode: string;
}

export interface StripeWebhookEvent {
  id: string;
  stripeEventId: string;
  eventType: string;
  eventData: any;
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}
