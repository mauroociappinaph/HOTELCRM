import { Controller, Post, Body, Headers, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StripeService } from './stripe.service';

@Controller('payments/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private configService: ConfigService,
    private stripeService: StripeService,
  ) {}

  /**
   * Handle Stripe webhooks
   */
  @Post()
  async handleWebhook(@Body() rawBody: Buffer, @Headers() headers: Record<string, string>) {
    try {
      const sig = headers['stripe-signature'];
      const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

      if (!sig || !webhookSecret) {
        throw new BadRequestException('Missing webhook signature or secret');
      }

      // Validate webhook signature
      const event = this.stripeService.validateWebhookSignature(rawBody, sig, webhookSecret);

      this.logger.log(`Received webhook event: ${event.type}`);

      // Process the event
      await this.stripeService.processWebhookEvent(event);

      // Return success response
      return { received: true, event: event.type };
    } catch (error) {
      this.logger.error('Webhook processing failed:', error);
      throw new BadRequestException('Webhook processing failed');
    }
  }
}
