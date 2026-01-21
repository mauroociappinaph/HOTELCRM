import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface QuarantinedRecord {
  id?: string;
  agencyId: string; // Required for multitenancy
  recordId: string;
  gateId: string;
  record: any;
  rejectionReason: string;
  validationErrors: any[];
  quarantinedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: 'approved' | 'rejected' | 'fixed' | 'pending';
  fixedRecord?: any;
  notes?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  context?: any;
}

export interface QuarantineStats {
  totalQuarantined: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  fixed: number;
  byGate: Record<string, number>;
  byPriority: Record<string, number>;
  byReason: Record<string, number>;
  averageResolutionTime: number;
}

@Injectable()
export class QuarantineService {
  private readonly logger = new Logger(QuarantineService.name);
  private readonly quarantineTable = 'quarantined_records';

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Store a rejected record in quarantine
   */
  async storeRejectedRecord(quarantinedRecord: Omit<QuarantinedRecord, 'id' | 'quarantinedAt'>): Promise<string> {
    try {
      const recordToStore = {
        ...quarantinedRecord,
        quarantinedAt: new Date(),
        priority: this.calculatePriority(quarantinedRecord),
      };

      const client = this.supabaseService.getClient();

      // 🛡️ SECURITY: Use safe Supabase client with explicit agencyId
      const { data, error } = await client
        .from(this.quarantineTable)
        .insert([
          {
            agency_id: recordToStore.agencyId,
            record_id: recordToStore.recordId,
            gate_id: recordToStore.gateId,
            record: recordToStore.record,
            rejection_reason: recordToStore.rejectionReason,
            validation_errors: recordToStore.validationErrors,
            quarantined_at: recordToStore.quarantinedAt.toISOString(),
            priority: recordToStore.priority,
            context: recordToStore.context || {},
          },
        ])
        .select('id')
        .single();

      if (error) {
        this.logger.error(`Failed to store quarantined record ${recordToStore.recordId}:`, error);
        throw new Error(`Database error: ${error.message}`);
      }

      this.logger.warn(
        `🚨 Record quarantined: ${recordToStore.recordId} for agency ${recordToStore.agencyId}`,
      );
      return data.id;
    } catch (error) {
      this.logger.error(`Failed to quarantine record ${quarantinedRecord.recordId}:`, error);
      throw error;
    }
  }

  /**
   * Get quarantined records with filtering
   */
  async getQuarantinedRecords(agencyId: string, filters?: {
    gateId?: string;
    priority?: string;
    resolution?: string;
    reviewed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<QuarantinedRecord[]> {
    try {
      const client = this.supabaseService.getClient();
      
      // 🛡️ SECURITY: Force agency_id filter
      let query = client
        .from(this.quarantineTable)
        .select('*')
        .eq('agency_id', agencyId)
        .order('quarantined_at', { ascending: false });

      if (filters?.gateId) {
        query = query.eq('gate_id', filters.gateId);
      }

      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }

      if (filters?.resolution) {
        query = query.eq('resolution', filters.resolution);
      }

      if (filters?.reviewed !== undefined) {
        if (filters.reviewed) {
          query = query.not('reviewed_at', 'is', null);
        } else {
          query = query.is('reviewed_at', null);
        }
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Failed to fetch quarantined records:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      return data.map((row) => this.mapFromDb(row));
    } catch (error) {
      this.logger.error('Failed to get quarantined records:', error);
      return [];
    }
  }

  /**
   * Review and resolve a quarantined record
   */
  async reviewQuarantinedRecord(
    agencyId: string,
    recordId: string,
    resolution: 'approved' | 'rejected' | 'fixed',
    reviewedBy: string,
    notes?: string,
    fixedRecord?: any,
  ): Promise<boolean> {
    try {
      const client = this.supabaseService.getClient();

      const updateData: any = {
        resolution,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy,
        notes,
      };

      if (fixedRecord) {
        updateData.fixed_record = fixedRecord;
      }

      // 🛡️ SECURITY: Enforce agency_id on update
      const { error } = await client
        .from(this.quarantineTable)
        .update(updateData)
        .eq('record_id', recordId)
        .eq('agency_id', agencyId);

      if (error) {
        this.logger.error(`Failed to review quarantined record ${recordId}:`, error);
        return false;
      }

      this.logger.log(`✅ Quarantined record ${recordId} resolved as: ${resolution}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to review quarantined record ${recordId}:`, error);
      return false;
    }
  }

  /**
   * Get quarantine statistics
   */
  async getQuarantineStats(agencyId: string): Promise<QuarantineStats> {
    try {
      const client = this.supabaseService.getClient();

      // 🛡️ SECURITY: Filter by agencyId
      const { data, error } = await client
        .from(this.quarantineTable)
        .select('gate_id, priority, rejection_reason, resolution, quarantined_at, reviewed_at')
        .eq('agency_id', agencyId);

      if (error) {
        this.logger.error('Failed to get quarantine stats:', error);
        return this.getEmptyStats();
      }

      const stats = this.getEmptyStats();

      for (const record of data) {
        stats.totalQuarantined++;

        switch (record.resolution) {
          case 'approved': stats.approved++; break;
          case 'rejected': stats.rejected++; break;
          case 'fixed': stats.fixed++; break;
          default: stats.pendingReview++;
        }

        stats.byGate[record.gate_id] = (stats.byGate[record.gate_id] || 0) + 1;
        stats.byPriority[record.priority || 'medium'] = (stats.byPriority[record.priority || 'medium'] || 0) + 1;
        stats.byReason[record.rejection_reason] = (stats.byReason[record.rejection_reason] || 0) + 1;

        if (record.reviewed_at && record.quarantined_at) {
          const resolutionTime = new Date(record.reviewed_at).getTime() - new Date(record.quarantined_at).getTime();
          stats.averageResolutionTime = stats.averageResolutionTime === 0 ? resolutionTime : (stats.averageResolutionTime + resolutionTime) / 2;
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get quarantine statistics:', error);
      return this.getEmptyStats();
    }
  }

  private mapFromDb(row: any): QuarantinedRecord {
    return {
      id: row.id,
      agencyId: row.agency_id,
      recordId: row.record_id,
      gateId: row.gate_id,
      record: row.record,
      rejectionReason: row.rejection_reason,
      validationErrors: row.validation_errors || [],
      quarantinedAt: new Date(row.quarantined_at),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      reviewedBy: row.reviewed_by,
      resolution: row.resolution,
      fixedRecord: row.fixed_record,
      notes: row.notes,
      priority: row.priority || 'medium',
      context: row.context,
    };
  }

  private getEmptyStats(): QuarantineStats {
    return {
      totalQuarantined: 0,
      pendingReview: 0,
      approved: 0,
      rejected: 0,
      fixed: 0,
      byGate: {},
      byPriority: { low: 0, medium: 0, high: 0, critical: 0 },
      byReason: {},
      averageResolutionTime: 0,
    };
  }

  private calculatePriority(record: any): 'low' | 'medium' | 'high' | 'critical' {
    if (record.gateId === 'payments-gate' && record.rejectionReason.includes('PAYMENT_AMOUNT_NEGATIVE')) return 'critical';
    if (record.gateId === 'bookings-gate' && record.rejectionReason.includes('BOOKING_DATES_INVALID')) return 'high';
    if (record.rejectionReason.includes('EVENT_TIME_FUTURE')) return 'high';
    return record.rejectionReason.includes('Schema validation failed') ? 'medium' : 'low';
  }
}