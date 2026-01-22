import { Test, TestingModule } from '@nestjs/testing';

import { MemoryManagerService } from '../../../src/modules/context-manager/memory-manager.service';
import { SupabaseService } from '../../../src/infrastructure/supabase/supabase.service';

describe('MemoryManagerService (Multitenancy)', () => {
  let service: MemoryManagerService;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    mockSupabaseClient = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 'memory-1' }, error: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryManagerService,
        { provide: SupabaseService, useValue: { getClient: () => mockSupabaseClient } },
      ],
    }).compile();

    service = module.get<MemoryManagerService>(MemoryManagerService);
  });

  describe('storeSemanticMemory', () => {
    it('should include agencyId in storage query', async () => {
      // Arrange
      const memory = {
        agencyId: 'agency-1',
        concept: 'Secret Project',
        category: 'confidential',
        facts: ['Top secret info'],
        relationships: [],
        confidence: 1,
        source: 'test',
      };

      // Mock existing check to return null (not found)
      mockSupabaseClient.single.mockResolvedValueOnce({ data: null });

      // Act
      await service.storeSemanticMemory(memory);

      // Assert: Check existence query uses agencyId
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('semantic_memories');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('agency_id', 'agency-1');

      // Assert: Insert uses agencyId
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          agency_id: 'agency-1',
          concept: 'Secret Project',
        }),
      );
    });
  });

  describe('queryMemories', () => {
    it('should filter semantic memories by agencyId', async () => {
      // Arrange
      mockSupabaseClient.select.mockReturnThis(); // Mock chain

      // Act
      await service.queryMemories({
        type: 'semantic',
        query: 'secret',
        agencyId: 'agency-1',
      });

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('semantic_memories');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('agency_id', 'agency-1');
    });

    it('should filter procedural memories by agencyId', async () => {
      // Arrange
      mockSupabaseClient.select.mockReturnThis();

      // Act
      await service.queryMemories({
        type: 'procedural',
        query: 'hack',
        agencyId: 'agency-1',
      });

      // Assert
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('procedural_memories');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('agency_id', 'agency-1');
    });
  });
});
