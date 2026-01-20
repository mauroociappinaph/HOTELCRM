import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover' as any,
    });
  }

  /**
   * Create or retrieve Stripe customer
   */
  async createOrRetrieveCustomer(userId: string, agencyId: string, email: string, name?: string): Promise<string> {
    try {
      const client = this.supabaseService.getClient();

      // Check if customer already exists in our database
      const { data: existingCustomer, error: customerError } = await client
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .eq('agency_id', agencyId)
        .single();

      if (customerError && customerError.code !== 'PGRST116') {
        throw customerError;
      }

      if (existingCustomer) {
        // Verify customer still exists in Stripe
        try {
          await this.stripe.customers.retrieve(existingCustomer.stripe_customer_id);
          return existingCustomer.stripe_customer_id;
        } catch (error) {
          // Customer doesn't exist in Stripe, remove from our DB and create new one
          await client
            .from('stripe_customers')
            .delete()
            .eq('user_id', userId)
            .eq('agency_id', agencyId);
        }
      }

      // Create new Stripe customer
      const customer = await this.stripe.customers.create({
        email,
        name: name || email,
        metadata: {
          user_id: userId,
          agency_id: agencyId,
        },
      });

      // Save to our database
      const { error: insertError } = await client
        .from('stripe_customers')
        .insert({
          user_id: userId,
          agency_id: agencyId,
          stripe_customer_id: customer.id,
          email,
          name: name || email,
        });

      if (insertError) {
        throw insertError;
      }

      this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
      return customer.id;
    } catch (error) {
      this.logger.error('Error creating/retrieving Stripe customer:', error);
      throw new BadRequestException('Failed to create Stripe customer');
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    userId: string,
    agencyId: string,
    couponCode?: string,
  ): Promise<Stripe.Subscription> {
    try {
      const subscriptionData: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          user_id: userId,
          agency_id: agencyId,
        },
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      };

      // Apply coupon if provided
      if (couponCode) {
        const coupon = await this.getCouponByCode(couponCode);
        if (coupon) {
          subscriptionData.discounts = [{ coupon: coupon.stripe_coupon_id }];
        }
      }

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      this.logger.log(`Created subscription ${subscription.id} for customer ${customerId}`);
      return subscription;
    } catch (error) {
      this.logger.error('Error creating subscription:', error);
      throw new BadRequestException('Failed to create subscription');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd,
      });

      this.logger.log(`Updated subscription ${subscriptionId} - cancel at period end: ${cancelAtPeriodEnd}`);
      return subscription;
    } catch (error) {
      this.logger.error('Error canceling subscription:', error);
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  /**
   * Create payment intent for one-time payments
   */
  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId?: string,
    metadata?: Record<string, any>,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        metadata: metadata || {},
        automatic_payment_methods: {
          enabled: true,
        },
      });

      this.logger.log(`Created payment intent ${paymentIntent.id} for amount ${amount} ${currency}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error('Error creating payment intent:', error);
      throw new BadRequestException('Failed to create payment intent');
    }
  }

  /**
   * Retrieve subscription
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      this.logger.error('Error retrieving subscription:', error);
      throw new NotFoundException('Subscription not found');
    }
  }

  /**
   * List customer subscriptions
   */
  async listCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
      });

      return subscriptions.data;
    } catch (error) {
      this.logger.error('Error listing customer subscriptions:', error);
      throw new BadRequestException('Failed to list subscriptions');
    }
  }

  /**
   * Get subscription plans/prices
   */
  async getSubscriptionPlans(): Promise<Stripe.Price[]> {
    try {
      const prices = await this.stripe.prices.list({
        active: true,
        type: 'recurring',
      });

      return prices.data;
    } catch (error) {
      this.logger.error('Error retrieving subscription plans:', error);
      throw new BadRequestException('Failed to retrieve subscription plans');
    }
  }

  /**
   * Create coupon
   */
  async createCoupon(
    percentOff?: number,
    amountOff?: number,
    currency?: string,
    duration: 'forever' | 'once' | 'repeating' = 'once',
    durationInMonths?: number,
    name?: string,
  ): Promise<Stripe.Coupon> {
    try {
      const couponData: Stripe.CouponCreateParams = {
        duration,
        name,
      };

      if (percentOff) {
        couponData.percent_off = percentOff;
      } else if (amountOff) {
        couponData.amount_off = amountOff;
        couponData.currency = currency || 'usd';
      }

      if (duration === 'repeating' && durationInMonths) {
        couponData.duration_in_months = durationInMonths;
      }

      const coupon = await this.stripe.coupons.create(couponData);

      this.logger.log(`Created coupon ${coupon.id}`);
      return coupon;
    } catch (error) {
      this.logger.error('Error creating coupon:', error);
      throw new BadRequestException('Failed to create coupon');
    }
  }

  /**
   * Get coupon by code
   */
  private async getCouponByCode(code: string): Promise<any> {
    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error) {
      this.logger.error('Error getting coupon by code:', error);
      return null;
    }
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      // Save webhook event
      await client.from('stripe_webhook_events').insert({
        stripe_event_id: event.id,
        event_type: event.type,
        event_data: event.data,
        processed: false,
      });

      // Process different event types
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeletion(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePayment(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailure(event.data.object as Stripe.Invoice);
          break;

        default:
          this.logger.log(`Unhandled webhook event: ${event.type}`);
      }

      // Mark as processed
      await client
        .from('stripe_webhook_events')
        .update({
          processed: true,
          processed_at: new Date(),
        })
        .eq('stripe_event_id', event.id);

    } catch (error) {
      this.logger.error('Error processing webhook event:', error);

      // Mark as failed
      const client = this.supabaseService.getClient();
      await client
        .from('stripe_webhook_events')
        .update({
          processed: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('stripe_event_id', event.id);

      throw error;
    }
  }

  /**
   * Handle subscription changes (create/update)
   */
  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      // Get user_id and agency_id from customer metadata
      const customer = await this.stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
      const userId = customer.metadata?.user_id;
      const agencyId = customer.metadata?.agency_id;

      if (!userId || !agencyId) {
        throw new Error('Missing user_id or agency_id in customer metadata');
      }

      // Get plan info
      const priceId = subscription.items.data[0]?.price.id;
      const { data: plan } = await client
        .from('subscription_plans')
        .select('id')
        .eq('stripe_price_id', priceId)
        .single();

      if (!plan) {
        throw new Error(`Plan not found for price ${priceId}`);
      }

      // Upsert subscription
      const subscriptionData = {
        user_id: userId,
        agency_id: agencyId,
        stripe_customer_id: subscription.customer as string,
        plan_id: plan.id,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date((subscription as any).current_period_start * 1000),
        current_period_end: new Date((subscription as any).current_period_end * 1000),
        trial_start: subscription.trial_start ? new Date((subscription as any).trial_start * 1000) : null,
        trial_end: subscription.trial_end ? new Date((subscription as any).trial_end * 1000) : null,
        cancel_at: (subscription as any).cancel_at ? new Date((subscription as any).cancel_at * 1000) : null,
        canceled_at: (subscription as any).canceled_at ? new Date((subscription as any).canceled_at * 1000) : null,
        ended_at: (subscription as any).ended_at ? new Date((subscription as any).ended_at * 1000) : null,
      };

      const { error } = await client
        .from('subscriptions')
        .upsert(subscriptionData, {
          onConflict: 'user_id,agency_id',
        });

      if (error) {
        throw error;
      }

      this.logger.log(`Updated subscription ${subscription.id} for user ${userId}`);
    } catch (error) {
      this.logger.error('Error handling subscription change:', error);
      throw error;
    }
  }

  /**
   * Handle subscription deletion
   */
  private async handleSubscriptionDeletion(subscription: Stripe.Subscription): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      const { error } = await client
        .from('subscriptions')
        .update({
          status: 'canceled',
          ended_at: new Date(),
        })
        .eq('stripe_subscription_id', subscription.id);

      if (error) {
        throw error;
      }

      this.logger.log(`Marked subscription ${subscription.id} as ended`);
    } catch (error) {
      this.logger.error('Error handling subscription deletion:', error);
      throw error;
    }
  }

  /**
   * Handle successful invoice payment
   */
  private async handleInvoicePayment(invoice: Stripe.Invoice): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      // Create invoice record
      const invoiceData: any = {
        stripe_invoice_id: invoice.id,
        status: invoice.status,
        amount_due_cents: invoice.amount_due,
        amount_paid_cents: invoice.amount_paid,
        currency: invoice.currency,
        invoice_pdf_url: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
        billing_reason: invoice.billing_reason,
        period_start: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
        period_end: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      };

      // Link to subscription and user if possible
      if ((invoice as any).subscription) {
        const { data: subscription } = await client
          .from('subscriptions')
          .select('user_id, agency_id, stripe_customer_id, id')
          .eq('stripe_subscription_id', (invoice as any).subscription as string)
          .single();

        if (subscription) {
          invoiceData.user_id = subscription.user_id;
          invoiceData.agency_id = subscription.agency_id;
          invoiceData.stripe_customer_id = subscription.stripe_customer_id;
          invoiceData.subscription_id = subscription.id;
        }
      }

      const { error } = await client
        .from('invoices')
        .upsert(invoiceData, {
          onConflict: 'stripe_invoice_id',
        });

      if (error) {
        throw error;
      }

      this.logger.log(`Recorded payment for invoice ${invoice.id}`);
    } catch (error) {
      this.logger.error('Error handling invoice payment:', error);
      throw error;
    }
  }

  /**
   * Handle failed invoice payment
   */
  private async handleInvoicePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      const { error } = await client
        .from('invoices')
        .update({
          status: 'uncollectible',
        })
        .eq('stripe_invoice_id', invoice.id);

      if (error) {
        throw error;
      }

      this.logger.log(`Marked invoice ${invoice.id} as payment failed`);
    } catch (error) {
      this.logger.error('Error handling invoice payment failure:', error);
      throw error;
    }
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: Buffer, signature: string, webhookSecret: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error('Webhook signature validation failed:', error);
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
