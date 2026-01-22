import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class PiiService {
  private readonly logger = new Logger(PiiService.name);

  // Regex patterns for common PII
  private readonly patterns = {
    email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    creditCard: /(?:\d{4}[-\s]?){3}\d{4}/g,
    phone: /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/g,
    ssn: /\d{3}[-]?\d{2}[-]?\d{4}/g,
    // Add more as needed
  };

  /**
   * Scrub PII from text
   */
  scrub(text: string): string {
    if (!text) return text;
    let scrubbed = text;

    try {
      // Replace Email
      scrubbed = scrubbed.replace(this.patterns.email, '[EMAIL_REDACTED]');

      // Replace Credit Card
      scrubbed = scrubbed.replace(this.patterns.creditCard, '[CARD_REDACTED]');

      // Replace Phone (careful with false positives, simple regex used)
      // scrubbed = scrubbed.replace(this.patterns.phone, '[PHONE_REDACTED]');
      // Commented out phone for now to avoid scrubbing standard numbers/dates indiscriminately without better context

      // Replace SSN
      scrubbed = scrubbed.replace(this.patterns.ssn, '[SSN_REDACTED]');
    } catch (error) {
      this.logger.error('Error scrubbing PII', error);
      // Fail safe: return original or empty? Return original but log error is safer for availability,
      // but returning redacted error message might be safer for security.
      // For now, return partially scrubbed text.
    }

    return scrubbed;
  }

  /**
   * Check if text contains potential PII
   */
  containsPii(text: string): boolean {
    return (
      this.patterns.email.test(text) ||
      this.patterns.creditCard.test(text) ||
      this.patterns.ssn.test(text)
    );
  }
}
