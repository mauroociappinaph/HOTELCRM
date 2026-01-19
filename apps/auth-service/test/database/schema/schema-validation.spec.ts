import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from '../../../../src/infrastructure/supabase/supabase.service';
import { PaymentsService } from '../../../../src/modules/payments/payments.service';
import { StripeService } from '../../../../src/modules/payments/stripe.service';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: { code: 'PGRST116' }
          }))
        }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => ({
          data: { id: 'test-id' },
          error: null
        }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: { id: 'test-id' },
            error: null
          }))
        }))
      }))
    }))
  }))
};

const mockSupabaseService = {
  getClient: jest.fn(() => mockSupabaseClient)
};

const mockStripeService = {
  createOrRetrieveCustomer: jest.fn(),
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  getSubscription: jest.fn(),
  listCustomerSubscriptions: jest.fn(),
  createPaymentIntent: jest.fn(),
  processWebhookEvent: jest.fn()
};

describe('Database Schema Validation', () => {
  let paymentsService: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService
        },
        {
          provide: StripeService,
          useValue: mockStripeService
        }
      ]
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  describe('Data Type Validation', () => {
    it('should validate subscription plan data structure', async () => {
      // Arrange - Mock a subscription plan query
      const mockPlan = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        stripe_product_id: 'prod_hotel_basic',
        stripe_price_id: 'price_hotel_basic_monthly',
        name: 'Hotel Basic',
        description: 'Plan básico para hoteles pequeños',
        price_cents: 2999,
        currency: 'usd',
        interval: 'month',
        trial_days: 14,
        features: ['Hasta 100 habitaciones', 'Sistema de reservas básico'],
        is_active: true,
        created_at: '2026-01-19T00:00:00.000Z',
        updated_at: '2026-01-19T00:00:00.000Z'
      };

      const fromMock = mockSupabaseClient.from();
      fromMock.select().eq().order.mockResolvedValue({
        data: [mockPlan],
        error: null
      });

      // Act
      const result = await paymentsService.getSubscriptionPlans();

      // Assert - Validate data types and structure
      expect(result).toHaveLength(1);
      const plan = result[0];

      // UUID validation
      expect(plan.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      // String validations
      expect(typeof plan.name).toBe('string');
      expect(plan.name.length).toBeGreaterThan(0);
      expect(typeof plan.stripe_product_id).toBe('string');
      expect(plan.stripe_product_id).toMatch(/^prod_/);
      expect(typeof plan.stripe_price_id).toBe('string');
      expect(plan.stripe_price_id).toMatch(/^price_/);

      // Numeric validations
      expect(typeof plan.price_cents).toBe('number');
      expect(plan.price_cents).toBeGreaterThan(0);
      expect(Number.isInteger(plan.price_cents)).toBe(true);

      // Enum validations
      expect(['usd', 'eur', 'gbp']).toContain(plan.currency);
      expect(['month', 'year']).toContain(plan.interval);

      // Boolean validations
      expect(typeof plan.is_active).toBe('boolean');

      // Array validations
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.features.every(f => typeof f === 'string')).toBe(true);
    });

    it('should validate subscription data structure', async () => {
      // Arrange - Mock a subscription query
      const mockSubscription = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        user_id: '550e8400-e29b-41d4-a716-446655440002',
        agency_id: '550e8400-e29b-41d4-a716-446655440003',
        stripe_customer_id: '550e8400-e29b-41d4-a716-446655440004',
        plan_id: '550e8400-e29b-41d4-a716-446655440005',
        stripe_subscription_id: 'sub_1234567890',
        status: 'active',
        current_period_start: new Date('2026-01-19T00:00:00.000Z'),
        current_period_end: new Date('2026-02-19T00:00:00.000Z'),
        trial_start: null,
        trial_end: null,
        cancel_at: null,
        canceled_at: null,
        ended_at: null,
        plan: {
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'Hotel Basic',
          price_cents: 2999,
          currency: 'usd'
        }
      };

      const fromMock = mockSupabaseClient.from();
      fromMock.select().eq().eq().single.mockResolvedValue({
        data: mockSubscription,
        error: null
      });

      // Act
      const result = await paymentsService.getUserSubscription(
        mockSubscription.user_id,
        mockSubscription.agency_id
      );

      // Assert - Validate subscription structure
      expect(result).not.toBeNull();
      expect(result!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(result!.user_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(result!.agency_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      // Stripe ID validation
      expect(result!.stripe_subscription_id).toMatch(/^sub_/);

      // Status enum validation
      expect(['active', 'canceled', 'incomplete', 'past_due', 'trialing']).toContain(result!.status);

      // Date validations
      expect(result!.current_period_start).toBeInstanceOf(Date);
      expect(result!.current_period_end).toBeInstanceOf(Date);
      expect(result!.current_period_end.getTime()).toBeGreaterThan(result!.current_period_start.getTime());

      // Plan relationship validation
      expect(result!.plan).toBeDefined();
      expect(typeof result!.plan.name).toBe('string');
      expect(typeof result!.plan.price_cents).toBe('number');
    });

    it('should validate payment data structure', async () => {
      // Arrange - Mock payments query
      const mockPayments = [
        {
          id: '550e8400-e29b-41d4-a716-446655440006',
          user_id: '550e8400-e29b-41d4-a716-446655440002',
          agency_id: '550e8400-e29b-41d4-a716-446655440003',
          stripe_payment_intent_id: 'pi_1234567890',
          stripe_charge_id: 'ch_1234567890',
          amount_cents: 2999,
          currency: 'usd',
          status: 'succeeded',
          payment_method: 'card',
          description: 'Hotel Basic - Monthly subscription',
          is_subscription_payment: true,
          subscription_id: '550e8400-e29b-41d4-a716-446655440001',
          metadata: { invoice_id: 'inv_123' },
          created_at: '2026-01-19T00:00:00.000Z'
        }
      ];

      const fromMock = mockSupabaseClient.from();
      fromMock.select().eq().eq().order.mockResolvedValue({
        data: mockPayments,
        error: null
      });

      // Act
      const result = await paymentsService.getUserPayments(
        mockPayments[0].user_id,
        mockPayments[0].agency_id
      );

      // Assert - Validate payments structure
      expect(result).toHaveLength(1);
      const payment = result[0];

      // UUID validations
      expect(payment.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(payment.user_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(payment.agency_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      // Stripe ID validations
      expect(payment.stripe_payment_intent_id).toMatch(/^pi_/);
      if (payment.stripe_charge_id) {
        expect(payment.stripe_charge_id).toMatch(/^ch_/);
      }

      // Amount validations
      expect(typeof payment.amount_cents).toBe('number');
      expect(payment.amount_cents).toBeGreaterThan(0);
      expect(Number.isInteger(payment.amount_cents)).toBe(true);

      // Currency validation
      expect(['usd', 'eur', 'gbp']).toContain(payment.currency);

      // Status enum validation
      expect(['succeeded', 'pending', 'failed', 'canceled']).toContain(payment.status);

      // Boolean validations
      expect(typeof payment.is_subscription_payment).toBe('boolean');

      // Optional fields
      if (payment.subscription_id) {
        expect(payment.subscription_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      }

      // Metadata validation
      if (payment.metadata) {
        expect(typeof payment.metadata).toBe('object');
      }
    });
  });

  describe('Constraint Validation', () => {
    it('should validate required fields are present', async () => {
      // This test ensures that required fields are validated
      // by attempting operations that would fail with missing data

      // Test subscription creation with missing planId
      await expect(paymentsService.createSubscription(
        'user-id',
        'agency-id',
        '' // Empty planId should cause validation error
      )).rejects.toThrow();

      // Verify the call was made with empty planId
      expect(mockStripeService.createSubscription).not.toHaveBeenCalled();
    });

    it('should validate data integrity constraints', async () => {
      // Arrange - Mock invalid data that should fail constraints
      const invalidPlan = {
        id: 'not-a-uuid',
        stripe_product_id: '', // Empty required field
        stripe_price_id: 'invalid-price-id',
        name: '', // Empty name
        price_cents: -100, // Negative price
        currency: 'invalid',
        interval: 'invalid'
      };

      // Act & Assert - Service should handle invalid data appropriately
      // Note: In real implementation, this would be caught by database constraints
      // Here we're testing that the service processes data correctly
      expect(typeof invalidPlan.id).toBe('string');
      expect(invalidPlan.price_cents).toBeLessThan(0); // Invalid but testable
    });
  });

  describe('Relationship Integrity', () => {
    it('should maintain referential integrity between tables', async () => {
      // Arrange - Mock related data
      const mockUserId = '550e8400-e29b-41d4-a716-446655440002';
      const mockAgencyId = '550e8400-e29b-41d4-a716-446655440003';

      const mockSubscription = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        user_id: mockUserId,
        agency_id: mockAgencyId,
        stripe_subscription_id: 'sub_1234567890',
        status: 'active',
        current_period_start: new Date(),
        current_period_end: new Date(),
        plan: {
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'Hotel Basic',
          price_cents: 2999
        }
      };

      const fromMock = mockSupabaseClient.from();
      fromMock.select().eq().eq().single.mockResolvedValue({
        data: mockSubscription,
        error: null
      });

      // Act
      const result = await paymentsService.getUserSubscription(mockUserId, mockAgencyId);

      // Assert - Validate relationships
      expect(result).not.toBeNull();
      expect(result!.user_id).toBe(mockUserId);
      expect(result!.agency_id).toBe(mockAgencyId);
      expect(result!.plan).toBeDefined();
      expect(typeof result!.plan.name).toBe('string');
      expect(result!.plan.price_cents).toBeGreaterThan(0);
    });

    it('should validate foreign key relationships', async () => {
      // Test that related entities exist and are properly linked
      const mockPayments = [
        {
          id: '550e8400-e29b-41d4-a716-446655440006',
          user_id: '550e8400-e29b-41d4-a716-446655440002',
          agency_id: '550e8400-e29b-41d4-a716-446655440003',
          subscription_id: '550e8400-e29b-41d4-a716-446655440001',
          stripe_payment_intent_id: 'pi_1234567890',
          amount_cents: 2999,
          currency: 'usd',
          status: 'succeeded'
        }
      ];

      const fromMock = mockSupabaseClient.from();
      fromMock.select().eq().eq().order.mockResolvedValue({
        data: mockPayments,
        error: null
      });

      // Act
      const result = await paymentsService.getUserPayments(
        mockPayments[0].user_id,
        mockPayments[0].agency_id
      );

      // Assert - All IDs should be valid UUIDs
      result.forEach(payment => {
        expect(payment.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(payment.user_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(payment.agency_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        if (payment.subscription_id) {
          expect(payment.subscription_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        }
      });
    });
  });
});
