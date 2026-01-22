import { Test, TestingModule } from '@nestjs/testing';

// Mock the ESM module before importing anything that uses it
jest.mock('@openrouter/sdk', () => ({
  OpenRouter: jest.fn().mockImplementation(() => ({
    chat: {
      send: jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'AI Response' } }],
        usage: { totalTokens: 10 },
      }),
    },
  })),
}));

import { ChatService } from '../../../src/modules/ai/chat.service';
import { EmbeddingsService } from '../../../src/modules/ai/embeddings.service';
import { SupabaseService } from '../../../src/infrastructure/supabase/supabase.service';
import { ContextAssemblerService } from '../../../src/modules/context-manager/context-assembler.service';
import { MemoryManagerService } from '../../../src/modules/context-manager/memory-manager.service';
import { ContextOptimizerService } from '../../../src/modules/context-manager/context-optimizer.service';
import { PiiService } from '../../../src/modules/security/pii.service';

describe('ChatService (Security Integration)', () => {
  let service: ChatService;
  let piiService: PiiService;
  let mockSupabaseClient: any;
  let mockOpenRouter: any;
  let mockEmbeddingsService: any;
  let mockMemoryManager: any;

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'session-1', total_tokens: 0, total_cost: 0 },
        error: null,
      }),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    mockOpenRouter = {
      chat: {
        send: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'AI Response' } }],
          usage: { totalTokens: 10 },
        }),
      },
    };

    mockEmbeddingsService = {
      searchSimilarDocuments: jest.fn().mockResolvedValue([]),
    };

    mockMemoryManager = {
      queryMemories: jest.fn().mockResolvedValue([]),
      storeEpisodicMemory: jest.fn().mockResolvedValue('memory-1'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        PiiService, // Real PiiService
        { provide: SupabaseService, useValue: { getClient: () => mockSupabaseClient } },
        { provide: EmbeddingsService, useValue: mockEmbeddingsService },
        {
          provide: ContextAssemblerService,
          useValue: {
            assembleContext: jest.fn().mockResolvedValue({
              chunks: [],
              compressionRatio: 1,
              metadata: { strategiesUsed: [] },
            }),
          },
        },
        { provide: MemoryManagerService, useValue: mockMemoryManager },
        {
          provide: ContextOptimizerService,
          useValue: {
            optimizeContext: jest.fn().mockResolvedValue({
              chunks: [],
              compressionRatio: 1,
              relevanceScore: 1,
              metadata: { strategiesUsed: [] },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    piiService = module.get<PiiService>(PiiService);

    // Manual injection of mockOpenRouter since it's instantiated in constructor
    (service as any).openRouter = mockOpenRouter;
  });

  it('should scrub PII from user message before any external call or storage', async () => {
    // Arrange
    const sessionId = 'session-123';
    const userId = 'user-456';
    const agencyId = 'agency-789';
    const originalMessage = 'My email is hacker@evil.com and card is 1234-5678-9012-3456';
    const expectedScrubbed = 'My email is [EMAIL_REDACTED] and card is [CARD_REDACTED]';

    // Act
    await service.sendMessage(sessionId, userId, agencyId, originalMessage);

    // Assert 1: Database Storage (User Message)
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('ai_chat_messages');
    expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expectedScrubbed,
        role: 'user',
      }),
    );

    // Assert 2: Embeddings Search
    expect(mockEmbeddingsService.searchSimilarDocuments).toHaveBeenCalledWith(
      expectedScrubbed,
      agencyId,
      expect.any(Number),
    );

    // Assert 3: LLM Call
    expect(mockOpenRouter.chat.send).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: expectedScrubbed }),
        ]),
      }),
    );

    // Assert 4: Memory Storage
    expect(mockMemoryManager.storeEpisodicMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(expectedScrubbed),
      }),
    );
  });
});
