import { Test, TestingModule } from '@nestjs/testing';

import { SupabaseQueryRepository } from '../../../../src/infrastructure/repositories/supabase.repository';
import { SupabaseService } from '../../../../src/infrastructure/supabase/supabase.service';

// Concrete implementation for testing abstract class
class TestRepository extends SupabaseQueryRepository<any> {
  constructor(supabaseService: SupabaseService) {
    super(supabaseService, 'test_table');
  }

  protected getSelectedFields(): string[] {
    return ['id', 'name', 'description'];
  }
}

describe('SupabaseRepository (Security)', () => {
  let repository: TestRepository;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    // Chainable mock implementation
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: jest.fn((resolve) => resolve({ data: [], error: null, count: 0 })),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: { getClient: () => mockSupabaseClient },
        },
      ],
    }).compile();

    const supabaseService = module.get<SupabaseService>(SupabaseService);
    repository = new TestRepository(supabaseService);
  });

  describe('search', () => {
    it('should sanitize search query by removing dangerous characters', async () => {
      // Arrange
      const maliciousQuery = 'test(injection),value';
      const searchQuery = {
        query: maliciousQuery,
        fields: ['name', 'description'],
      };

      // Act
      await repository.search(searchQuery);

      // Assert
      // The implementation does: query.query.replace(/[(),]/g, '')
      // 'test(injection),value' -> 'testinjectionvalue'
      // It constructs: name.ilike.%testinjectionvalue%,description.ilike.%testinjectionvalue%

      const expectedSanitizedTerm = 'testinjectionvalue';
      const mockOr = mockSupabaseClient.from().select().or;

      expect(mockOr).toHaveBeenCalledWith(expect.stringContaining(expectedSanitizedTerm));

      expect(mockOr).toHaveBeenCalledWith(expect.not.stringContaining('('));
      expect(mockOr).toHaveBeenCalledWith(expect.not.stringContaining(')'));
      // comma is used as separator in .or(), so we check that the *values* don't have extra commas
      // The .or() argument is "cond1,cond2".
      // cond1 = name.ilike.%testinjectionvalue%
      // cond2 = description.ilike.%testinjectionvalue%
      // So valid commas are separators, but the injected comma in 'value' should be gone from the term itself.

      const callArg = mockOr.mock.calls[0][0];
      // Check that the term inside %...% does not contain comma
      const matches = callArg.match(/ilike\.%([^%]+)%/g);
      if (matches) {
        matches.forEach((match) => {
          expect(match).not.toContain('(');
          expect(match).not.toContain(')');
          // The match is "ilike.%testinjectionvalue%"
          expect(match).toContain(expectedSanitizedTerm);
        });
      }
    });

    it('should handle clean queries correctly', async () => {
      // Arrange
      const cleanQuery = 'safe-text';
      const searchQuery = {
        query: cleanQuery,
        fields: ['name'],
      };

      // Act
      await repository.search(searchQuery);

      // Assert
      const mockOr = mockSupabaseClient.from().select().or;
      expect(mockOr).toHaveBeenCalledWith(expect.stringContaining(cleanQuery));
    });
  });
});
