import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);
  private deduplicationCache = new Map<string, Set<string>>();

  /**
   * Deduplicate records based on ID and time window
   */
  async deduplicate(records: any[], windowMinutes: number): Promise<any[]> {
    const deduplicatedRecords: any[] = [];
    const seenIds = new Set<string>();

    for (const record of records) {
      const recordId = this.getRecordId(record);

      if (!seenIds.has(recordId)) {
        seenIds.add(recordId);
        deduplicatedRecords.push(record);
      }
    }

    const duplicatesRemoved = records.length - deduplicatedRecords.length;
    if (duplicatesRemoved > 0) {
      this.logger.log(`🗑️ Removed ${duplicatesRemoved} duplicate records`);
    }

    return deduplicatedRecords;
  }

  /**
   * Extract unique identifier from record
   */
  private getRecordId(record: any): string {
    // Try different ID fields
    return record.id || record.recordId || record.eventId || record.sequenceNumber?.toString() || JSON.stringify(record.data);
  }

  /**
   * Clear deduplication cache (useful for memory management)
   */
  clearCache(): void {
    this.deduplicationCache.clear();
    this.logger.log('🧹 Cleared deduplication cache');
  }
}
