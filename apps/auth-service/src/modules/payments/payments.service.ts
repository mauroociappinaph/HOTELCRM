import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { StripeService } from './stripe.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private supabaseService: SupabaseService,
    private stripeService: StripeService,
  ) {}

  /**
   * Get user subscription status
   */
  async getUserSubscription(userId: string, agencyId: string) {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('user_id', userId)
        .eq('agency_id', agencyId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Error getting user subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription plans
   */
  async getSubscriptionPlans() {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_cents');

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Error getting subscription plans:', error);
      throw error;
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(userId: string, agencyId: string, planId: string, couponCode?: string) {
    try {
      // Get plan details
      const client = this.supabaseService.getClient();
      const { data: plan, error: planError } = await client
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError || !plan) {
        throw new Error('Plan not found');
      }

      // Get user details
      const { data: user, error: userError } = await client.auth.admin.getUserById(userId);
      if (userError || !user.user) {
        throw new Error('User not found');
      }

      // Create or retrieve Stripe customer
      const customerId = await this.stripeService.createOrRetrieveCustomer(
        userId,
        agencyId,
        user.user.email || '',
        user.user.user_metadata?.name || user.user.email,
      );

      // Create subscription in Stripe
      const subscription = await this.stripeService.createSubscription(
        customerId,
        plan.stripe_price_id,
        userId,
        agencyId,
        couponCode,
      );

      this.logger.log(`Created subscription ${subscription.id} for user ${userId}`);
      return subscription;
    } catch (error) {
      this.logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string, agencyId: string, cancelAtPeriodEnd: boolean = true) {
    try {
      const subscription = await this.getUserSubscription(userId, agencyId);
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const result = await this.stripeService.cancelSubscription(
        subscription.stripe_subscription_id,
        cancelAtPeriodEnd,
      );

      this.logger.log(`Cancelled subscription ${subscription.stripe_subscription_id}`);
      return result;
    } catch (error) {
      this.logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Get user payment history
   */
  async getUserPayments(userId: string, agencyId: string) {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Error getting user payments:', error);
      throw error;
    }
  }

  /**
   * Get user invoices
   */
  async getUserInvoices(userId: string, agencyId: string) {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Error getting user invoices:', error);
      throw error;
    }
  }

  /**
   * Apply coupon to subscription
   */
  async applyCoupon(subscriptionId: string, couponCode: string) {
    try {
      // This would be implemented to apply coupons to existing subscriptions
      // For now, coupons are only applied during subscription creation
      throw new Error('Coupon application not yet implemented for existing subscriptions');
    } catch (error) {
      this.logger.error('Error applying coupon:', error);
      throw error;
    }
  }

  /**
   * Get usage statistics for user
   */
  async getUsageStats(userId: string, agencyId: string) {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('usage_records')
        .select('metric_name, quantity, unit, timestamp')
        .eq('user_id', userId)
        .eq('agency_id', agencyId)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Error getting usage stats:', error);
      throw error;
    }
  }
}
