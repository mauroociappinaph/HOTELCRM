/// <reference types="jest" />

import { beforeEach, describe, afterEach } from 'node:test';

import { Test, TestingModule } from '@nestjs/testing';

import { PaymentsService } from '../../../src/modules/payments/payments.service';
import { StripeService } from '../../../src/modules/payments/stripe.service';
import { SupabaseService } from '../../../src/infrastructure/supabase/supabase.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockSupabaseClient: ReturnType<typeof createMockSupabaseClient>;
  let mockStripeService: StripeService;

  // Helper para crear mocks limpios
  const createMockSupabaseClient = () => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn(),
  });

  beforeEach(async () => {
    mockSupabaseClient = createMockSupabaseClient();

    mockStripeService = {
      createOrRetrieveCustomer: jest.fn(),
      createSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => mockSupabaseClient },
        },
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSubscription', () => {
    const userId = 'test-user-id';
    const agencyId = 'test-agency-id';

    it('should return null when no subscription exists', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const result = await service.getUserSubscription(userId, agencyId);

      // Assert
      expect(result).toBeNull();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('subscriptions');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should return subscription when exists', async () => {
      // Arrange
      const mockSubscription = {
        id: 'sub-123',
        status: 'active',
        current_period_end: '2024-12-31T00:00:00Z',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      // Act
      const result = await service.getUserSubscription(userId, agencyId);

      // Assert
      expect(result).toEqual(mockSubscription);
    });

    it('should throw on database error', async () => {
      // Arrange
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed', code: '500' },
      });

      // Act & Assert
      await expect(service.getUserSubscription(userId, agencyId)).rejects.toThrow();
    });
  });
});
