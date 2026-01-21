import { Test, TestingModule } from '@nestjs/testing';

// Mock OpenRouter
jest.mock('@openrouter/sdk', () => ({
  OpenRouter: jest.fn().mockImplementation(() => ({
    embeddings: {
      generate: jest.fn().mockResolvedValue({
        data: [{ embedding: [] }]
      }),
    }
  }))
}));

import { EmbeddingsService } from '../../../src/modules/ai/embeddings.service';
import { SupabaseService } from '../../../src/infrastructure/supabase/supabase.service';
import { PiiService } from '../../../src/modules/security/pii.service';

describe('EmbeddingsService (Security)', () => {
  let service: EmbeddingsService;
  let mockSupabaseClient: any;
  let mockOpenRouter: any;
  let piiService: PiiService;

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        PiiService, // Real service
        { provide: SupabaseService, useValue: { getClient: () => mockSupabaseClient } },
      ],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);
    piiService = module.get<PiiService>(PiiService);
    
    // Manual injection of mockOpenRouter
    mockOpenRouter = {
      embeddings: {
        generate: jest.fn().mockResolvedValue({ data: [] })
      }
    };
    (service as any).openRouter = mockOpenRouter;
  });

  it('should scrub PII from text before generating embeddings', async () => {
    // Arrange
    const sensitiveText = 'My secret is user@secret.com';
    const expectedSafeText = 'My secret is [EMAIL_REDACTED]';

    // Act
    await service.generateEmbeddings(sensitiveText);

    // Assert
    expect(mockOpenRouter.embeddings.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expectedSafeText
      })
    );
  });
});
