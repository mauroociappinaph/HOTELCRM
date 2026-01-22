import { Injectable, Logger } from '@nestjs/common';
import { EtlRecord } from './interfaces/etl.interface';

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);
  private deduplicationCache = new Map<string, Set<string>>();

  /**
   * Deduplicate records based on ID and time window
   */
  async deduplicate<T>(records: EtlRecord<T>[], windowMinutes: number): Promise<EtlRecord<T>[]> {
    const deduplicatedRecords: EtlRecord<T>[] = [];
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
  private getRecordId(record: EtlRecord<unknown>): string {
    // Try different ID fields
    return (
      record.id ||
      record.sequenceNumber?.toString() ||
      JSON.stringify(record.data)
    );
  }

  /**
   * Clear deduplication cache (useful for memory management)
   */
  clearCache(): void {
    this.deduplicationCache.clear();
    this.logger.log('🧹 Cleared deduplication cache');
  }
}
