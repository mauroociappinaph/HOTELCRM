import { Test, TestingModule } from '@nestjs/testing';

import { PiiService } from '../../../src/modules/security/pii.service';

describe('PiiService', () => {
  let service: PiiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PiiService],
    }).compile();

    service = module.get<PiiService>(PiiService);
  });

  describe('scrub', () => {
    it('should redacted email addresses', () => {
      const input = 'Contact me at test.user@example.com for info.';
      const expected = 'Contact me at [EMAIL_REDACTED] for info.';
      expect(service.scrub(input)).toBe(expected);
    });

    it('should redacted credit card numbers', () => {
      const input = 'My card is 1234-5678-9012-3456 thank you.';
      const expected = 'My card is [CARD_REDACTED] thank you.';
      expect(service.scrub(input)).toBe(expected);
    });

    it('should redacted SSNs', () => {
      const input = 'SSN: 123-45-6789.';
      const expected = 'SSN: [SSN_REDACTED].';
      expect(service.scrub(input)).toBe(expected);
    });

    it('should handle mixed PII', () => {
      const input = 'Email: user@test.com, Card: 1234 5678 9012 3456';
      const expected = 'Email: [EMAIL_REDACTED], Card: [CARD_REDACTED]';
      expect(service.scrub(input)).toBe(expected);
    });

    it('should return original text if no PII found', () => {
      const input = 'Hello world, this is safe text.';
      expect(service.scrub(input)).toBe(input);
    });

    it('should handle empty input', () => {
      expect(service.scrub('')).toBe('');
    });
  });

  describe('containsPii', () => {
    it('should return true if email is present', () => {
      expect(service.containsPii('test@example.com')).toBe(true);
    });

    it('should return false if no PII is present', () => {
      expect(service.containsPii('safe text')).toBe(false);
    });
  });
});
