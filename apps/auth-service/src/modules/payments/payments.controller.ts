import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('payments')
@UseGuards(SupabaseAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Get subscription plans
   */
  @Get('plans')
  async getSubscriptionPlans() {
    return this.paymentsService.getSubscriptionPlans();
  }

  /**
   * Get current user subscription
   */
  @Get('subscription')
  async getUserSubscription(@Request() req: any) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    return this.paymentsService.getUserSubscription(userId, agencyId);
  }

  /**
   * Create subscription
   */
  @Post('subscription')
  async createSubscription(
    @Request() req: any,
    @Body() body: { planId: string; couponCode?: string },
  ) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';

    if (!body.planId) {
      throw new BadRequestException('planId is required');
    }

    return this.paymentsService.createSubscription(userId, agencyId, body.planId, body.couponCode);
  }

  /**
   * Cancel subscription
   */
  @Delete('subscription')
  async cancelSubscription(
    @Request() req: any,
    @Body() body: { cancelAtPeriodEnd?: boolean } = {},
  ) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    const cancelAtPeriodEnd = body.cancelAtPeriodEnd ?? true;

    return this.paymentsService.cancelSubscription(userId, agencyId, cancelAtPeriodEnd);
  }

  /**
   * Get payment history
   */
  @Get('history')
  async getUserPayments(@Request() req: any) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    return this.paymentsService.getUserPayments(userId, agencyId);
  }

  /**
   * Get invoices
   */
  @Get('invoices')
  async getUserInvoices(@Request() req: any) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    return this.paymentsService.getUserInvoices(userId, agencyId);
  }

  /**
   * Get usage statistics
   */
  @Get('usage')
  async getUsageStats(@Request() req: any) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';
    return this.paymentsService.getUsageStats(userId, agencyId);
  }

  /**
   * Apply coupon to subscription
   */
  @Post('coupon')
  async applyCoupon(
    @Request() req: any,
    @Body() body: { couponCode: string },
  ) {
    const userId = req.user.id;
    const agencyId = req.user.user_metadata?.agency_id || 'default';

    if (!body.couponCode) {
      throw new BadRequestException('couponCode is required');
    }

    // For now, coupons can only be applied during subscription creation
    // This endpoint could be extended to apply coupons to existing subscriptions
    return {
      message: 'Coupons can only be applied during subscription creation',
      couponCode: body.couponCode,
    };
  }
}
