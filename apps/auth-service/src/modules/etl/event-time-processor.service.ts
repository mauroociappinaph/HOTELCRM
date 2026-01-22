import { Injectable, Logger } from '@nestjs/common';
import { EtlRecord } from '@hotel-crm/shared';

@Injectable()
export class EventTimeProcessorService {
  private readonly logger = new Logger(EventTimeProcessorService.name);

  /**
   * Sort records by event time to handle out-of-order data
   */
  async sortByEventTime(records: EtlRecord[]): Promise<EtlRecord[]> {
    return records.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());
  }

  /**
   * Group records by time windows for batching
   */
  groupByTimeWindow(records: EtlRecord[], windowSizeMs: number): Map<number, EtlRecord[]> {
    const groups = new Map<number, EtlRecord[]>();

    records.forEach((record) => {
      const windowStart = Math.floor(record.eventTime.getTime() / windowSizeMs) * windowSizeMs;
      const group = groups.get(windowStart) || [];
      group.push(record);
      groups.set(windowStart, group);
    });

    return groups;
  }

  /**
   * Identify late-arriving records based on watermark
   */
  identifyLateRecords(records: EtlRecord[], watermark: Date): EtlRecord[] {
    return records.filter((record) => record.eventTime < watermark);
  }

  /**
   * Calculate event time statistics
   */
  getEventTimeStats(records: EtlRecord[]) {
    if (records.length === 0) {
      return { min: null, max: null, avg: null, count: 0 };
    }

    const times = records.map((r) => r.eventTime.getTime());
    const min = new Date(Math.min(...times));
    const max = new Date(Math.max(...times));
    const avg = new Date(times.reduce((sum, time) => sum + time, 0) / times.length);

    return { min, max, avg, count: records.length };
  }
}
