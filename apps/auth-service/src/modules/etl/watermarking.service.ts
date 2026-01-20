import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WatermarkingService {
  private readonly logger = new Logger(WatermarkingService.name);
  private watermarks = new Map<string, Date>();

  /**
   * Initialize watermark for a pipeline
   */
  async initializeWatermark(pipelineId: string, initialWatermark: Date): Promise<void> {
    this.watermarks.set(pipelineId, initialWatermark);
    this.logger.log(
      `🏷️ Initialized watermark for pipeline ${pipelineId}: ${initialWatermark.toISOString()}`,
    );
  }

  /**
   * Get current watermark for a pipeline
   */
  async getWatermark(pipelineId: string): Promise<Date> {
    return this.watermarks.get(pipelineId) || new Date(0);
  }

  /**
   * Update watermark for a pipeline
   */
  async updateWatermark(pipelineId: string, newWatermark: Date): Promise<void> {
    const currentWatermark = this.watermarks.get(pipelineId) || new Date(0);

    if (newWatermark > currentWatermark) {
      this.watermarks.set(pipelineId, newWatermark);
      this.logger.debug(
        `🏷️ Updated watermark for pipeline ${pipelineId}: ${newWatermark.toISOString()}`,
      );
    }
  }

  /**
   * Apply watermarking to records - filter out records before watermark
   */
  async applyWatermark(
    pipelineId: string,
    records: any[],
    watermarkDelayMinutes: number,
  ): Promise<any[]> {
    const watermark = await this.getWatermark(pipelineId);
    const delayedWatermark = new Date(watermark.getTime() - watermarkDelayMinutes * 60 * 1000);

    // For late-arriving data, we might still want to process records that arrived
    // after the watermark but before the delayed watermark
    const filteredRecords = records.filter((record) => {
      return record.eventTime >= delayedWatermark;
    });

    const lateRecords = records.length - filteredRecords.length;
    if (lateRecords > 0) {
      this.logger.warn(
        `🏷️ Filtered ${lateRecords} late-arriving records for pipeline ${pipelineId}`,
      );
    }

    return filteredRecords;
  }

  /**
   * Check if a record is considered late-arriving
   */
  async isLateArriving(pipelineId: string, recordEventTime: Date): Promise<boolean> {
    const watermark = await this.getWatermark(pipelineId);
    return recordEventTime < watermark;
  }

  /**
   * Get watermark statistics
   */
  getWatermarkStats(pipelineId: string) {
    const watermark = this.watermarks.get(pipelineId);
    return {
      pipelineId,
      watermark: watermark?.toISOString(),
      age: watermark ? Date.now() - watermark.getTime() : null,
    };
  }
}
