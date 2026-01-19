import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../../../src/modules/payments/payments.service';
import { StripeService } from '../../../src/modules/payments/stripe.service';
import { SupabaseService } from '../../../src/infrastructure/supabase/supabase.service';
import { faker } from '@faker-js/faker';

// Mock implementations
const mockSupabaseService = {
  getClient: jest.fn(() => ({
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
            data: { id: 'test-id', email: faker.internet.email() },
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: 'test-id', role: 'admin' },
              error: null
            }))
          }))
        }))
      }))
    }))
  }))
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

describe('PaymentsService', () => {
  let service: PaymentsService;
  let supabaseClient: any;

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

    service = module.get<PaymentsService>(PaymentsService);
    supabaseClient = mockSupabaseService.getClient();
  });

  describe('getUserSubscription', () => {
    it('should return null when no subscription exists', async () => {
      // Arrange
      const userId = faker.string.uuid();
      const agencyId = faker.string.uuid();

      // Act
      const result = await service.getUserSubscription(userId, agencyId);

      // Assert
      expect(result).toBeNull();
      expect(supabaseClient.from).toHaveBeenCalledWith('subscriptions');
    });

    it('should return subscription data when subscription exists', async () => {
      // Arrange
      const userId = faker.string.uuid();
      const agencyId = faker.string.uuid();
      const mockSubscription = {
        id: faker.string.uuid(),
        status: 'active',
        current_period_start: new Date(),
        current_period_end: new Date(),
        plan: {
          id: faker.string.uuid(),
          name: 'Premium Plan',
          price_cents: 2999
        }
      };

      const fromMock = supabaseClient.from();
      fromMock.select().eq().eq().single.mockResolvedValue({
        data: mockSubscription,
        error: null
      });

      // Act
      const result = await service.getUserSubscription(userId, agencyId);

      // Assert
      expect(result).toEqual(mockSubscription);
      expect(fromMock.select).toHaveBeenCalledWith(`
        *,
        plan:subscription_plans(*)
      `);
    });
  });

  describe('getSubscriptionPlans', () => {
    it('should return active subscription plans', async () => {
      // Arrange
      const mockPlans = [
        {
          id: faker.string.uuid(),
          name: 'Basic Plan',
          price_cents: 999,
          is_active: true
        },
        {
          id: faker.string.uuid(),
          name: 'Premium Plan',
          price_cents: 2999,
          is_active: true
        }
      ];

      const fromMock = supabaseClient.from();
      fromMock.select().eq().order.mockResolvedValue({
        data: mockPlans,
        error: null
      });

      // Act
      const result = await service.getSubscriptionPlans();

      // Assert
      expect(result).toEqual(mockPlans);
      expect(fromMock.select).toHaveBeenCalledWith('*');
      expect(fromMock.eq).toHaveBeenCalledWith('is_active', true);
      expect(fromMock.order).toHaveBeenCalledWith('price_cents');
    });
  });

  describe('getUserPayments', () => {
    it('should return user payment history', async () => {
      // Arrange
      const userId = faker.string.uuid();
      const agencyId = faker.string.uuid();

      const mockPayments = [
        {
          id: faker.string.uuid(),
          amount: 2999,
          currency: 'usd',
          status: 'succeeded',
          created_at: new Date().toISOString()
        }
      ];

      const fromMock = supabaseClient.from();
      fromMock.select().eq().eq().order.mockResolvedValue({
        data: mockPayments,
        error: null
      });

      // Act
      const result = await service.getUserPayments(userId, agencyId);

      // Assert
      expect(result).toEqual(mockPayments);
      expect(fromMock.select).toHaveBeenCalledWith('*');
      expect(fromMock.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics for user', async () => {
      // Arrange
      const userId = faker.string.uuid();
      const agencyId = faker.string.uuid();

      const mockUsage = [
        {
          metric_name: 'api_calls',
          quantity: 150,
          unit: 'calls',
          timestamp: new Date().toISOString()
        }
      ];

      const fromMock = supabaseClient.from();
      fromMock.select().eq().eq().order().limit.mockResolvedValue({
        data: mockUsage,
        error: null
      });

      // Act
      const result = await service.getUsageStats(userId, agencyId);

      // Assert
      expect(result).toEqual(mockUsage);
      expect(fromMock.select).toHaveBeenCalledWith('metric_name, quantity, unit, timestamp');
      expect(fromMock.limit).toHaveBeenCalledWith(100);
    });
  });
});
