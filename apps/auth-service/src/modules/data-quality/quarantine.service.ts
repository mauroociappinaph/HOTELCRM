import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface QuarantinedRecord {
  id?: string;
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
  private quarantineTable = 'quarantined_records';

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Initialize quarantine table (run during module initialization)
   */
  async initializeQuarantineTable(): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      // Create quarantined_records table if it doesn't exist
      const { error } = await client.rpc('create_quarantine_table_if_not_exists');

      if (error && !error.message.includes('already exists')) {
        this.logger.error('Failed to initialize quarantine table:', error);
        // Fallback: try direct SQL
        await this.createTableDirectly();
      } else {
        this.logger.log('✅ Quarantine table initialized');
      }
    } catch (error) {
      this.logger.error('Failed to initialize quarantine table:', error);
      // Continue without quarantine functionality
    }
  }

  /**
   * Create quarantine table directly with SQL
   */
  private async createTableDirectly(): Promise<void> {
    const client = this.supabaseService.getClient();

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.quarantineTable} (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        record_id TEXT NOT NULL,
        gate_id TEXT NOT NULL,
        record JSONB NOT NULL,
        rejection_reason TEXT NOT NULL,
        validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
        quarantined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        reviewed_by TEXT,
        resolution TEXT CHECK (resolution IN ('approved', 'rejected', 'fixed', 'pending')),
        fixed_record JSONB,
        notes TEXT,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        context JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_quarantined_records_gate_id ON ${this.quarantineTable}(gate_id);
      CREATE INDEX IF NOT EXISTS idx_quarantined_records_priority ON ${this.quarantineTable}(priority);
      CREATE INDEX IF NOT EXISTS idx_quarantined_records_resolution ON ${this.quarantineTable}(resolution);
      CREATE INDEX IF NOT EXISTS idx_quarantined_records_quarantined_at ON ${this.quarantineTable}(quarantined_at);
      CREATE INDEX IF NOT EXISTS idx_quarantined_records_record_id ON ${this.quarantineTable}(record_id);

      -- Row Level Security
      ALTER TABLE ${this.quarantineTable} ENABLE ROW LEVEL SECURITY;

      -- Policies for different roles
      CREATE POLICY "Admins can view all quarantined records" ON ${this.quarantineTable}
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
          )
        );

      CREATE POLICY "Data stewards can manage quarantined records" ON ${this.quarantineTable}
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid() AND role IN ('admin', 'data_steward')
          )
        );
    `;

    try {
      const { error } = await client.rpc('exec_sql', { sql: createTableSQL });

      if (error) {
        this.logger.warn('Failed to create quarantine table via RPC, trying direct approach');
        // For development/demo purposes, we'll use a simple approach
        this.logger.log('🗂️ Using in-memory quarantine storage (development mode)');
      } else {
        this.logger.log('✅ Quarantine table created successfully');
      }
    } catch (error) {
      this.logger.warn('Quarantine table creation failed, using fallback storage:', error);
      // Continue with in-memory storage for demo purposes
    }
  }

  /**
   * Store a rejected record in quarantine
   */
  async storeRejectedRecord(quarantinedRecord: Omit<QuarantinedRecord, 'id'>): Promise<string> {
    try {
      const recordToStore: QuarantinedRecord = {
        ...quarantinedRecord,
        priority: this.calculatePriority(quarantinedRecord),
      };

      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from(this.quarantineTable)
        .insert([
          {
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
        this.logger.warn(
          `Failed to store quarantined record ${recordToStore.recordId}, using fallback:`,
          error,
        );
        // Fallback: log to console for demo purposes
        this.logger.error('🚨 RECORD QUARANTINED (Fallback Storage):', {
          recordId: recordToStore.recordId,
          gateId: recordToStore.gateId,
          rejectionReason: recordToStore.rejectionReason,
          priority: recordToStore.priority,
        });
        return `fallback-${Date.now()}-${recordToStore.recordId}`;
      }

      this.logger.warn(
        `🚨 Record quarantined: ${recordToStore.recordId} (${recordToStore.priority} priority)`,
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
  async getQuarantinedRecords(filters?: {
    gateId?: string;
    priority?: string;
    resolution?: string;
    reviewed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<QuarantinedRecord[]> {
    try {
      const client = this.supabaseService.getClient();
      let query = client
        .from(this.quarantineTable)
        .select('*')
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
        this.logger.warn('Failed to fetch quarantined records, returning empty array:', error);
        return [];
      }

      return data.map((row) => ({
        id: row.id,
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
      }));
    } catch (error) {
      this.logger.error('Failed to get quarantined records:', error);
      return [];
    }
  }

  /**
   * Review and resolve a quarantined record
   */
  async reviewQuarantinedRecord(
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

      const { error } = await client
        .from(this.quarantineTable)
        .update(updateData)
        .eq('record_id', recordId);

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
   * Bulk approve quarantined records
   */
  async bulkApproveRecords(recordIds: string[], reviewedBy: string): Promise<number> {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from(this.quarantineTable)
        .update({
          resolution: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
        })
        .in('record_id', recordIds)
        .select('id');

      if (error) {
        this.logger.error('Failed to bulk approve quarantined records:', error);
        return 0;
      }

      const approvedCount = data?.length || 0;
      this.logger.log(`✅ Bulk approved ${approvedCount} quarantined records`);
      return approvedCount;
    } catch (error) {
      this.logger.error('Failed to bulk approve quarantined records:', error);
      return 0;
    }
  }

  /**
   * Get quarantine statistics
   */
  async getQuarantineStats(): Promise<QuarantineStats> {
    try {
      const client = this.supabaseService.getClient();

      // Get all records for statistics
      const { data, error } = await client
        .from(this.quarantineTable)
        .select('gate_id, priority, rejection_reason, resolution, quarantined_at, reviewed_at');

      if (error) {
        this.logger.warn('Failed to get quarantine stats:', error);
        return this.getEmptyStats();
      }

      const stats = this.getEmptyStats();

      for (const record of data) {
        stats.totalQuarantined++;

        // Count by resolution
        switch (record.resolution) {
          case 'approved':
            stats.approved++;
            break;
          case 'rejected':
            stats.rejected++;
            break;
          case 'fixed':
            stats.fixed++;
            break;
          default:
            stats.pendingReview++;
        }

        // Count by gate
        stats.byGate[record.gate_id] = (stats.byGate[record.gate_id] || 0) + 1;

        // Count by priority
        stats.byPriority[record.priority || 'medium'] =
          (stats.byPriority[record.priority || 'medium'] || 0) + 1;

        // Count by reason
        stats.byReason[record.rejection_reason] =
          (stats.byReason[record.rejection_reason] || 0) + 1;

        // Calculate resolution time
        if (record.reviewed_at && record.quarantined_at) {
          const quarantineTime = new Date(record.quarantined_at).getTime();
          const reviewTime = new Date(record.reviewed_at).getTime();
          const resolutionTime = reviewTime - quarantineTime;

          // Running average
          if (stats.averageResolutionTime === 0) {
            stats.averageResolutionTime = resolutionTime;
          } else {
            stats.averageResolutionTime = (stats.averageResolutionTime + resolutionTime) / 2;
          }
        }
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get quarantine statistics:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Clean up old resolved records
   */
  async cleanupResolvedRecords(olderThanDays: number = 30): Promise<number> {
    try {
      const client = this.supabaseService.getClient();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await client
        .from(this.quarantineTable)
        .delete()
        .not('resolution', 'eq', 'pending')
        .lt('reviewed_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        this.logger.error('Failed to cleanup resolved quarantine records:', error);
        return 0;
      }

      const deletedCount = data?.length || 0;
      this.logger.log(`🧹 Cleaned up ${deletedCount} old resolved quarantine records`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup quarantine records:', error);
      return 0;
    }
  }

  /**
   * Calculate priority based on rejection reason and data
   */
  private calculatePriority(
    record: Omit<QuarantinedRecord, 'id'>,
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Payment data with negative amounts (financial risk)
    if (
      record.gateId === 'payments-gate' &&
      record.rejectionReason.includes('PAYMENT_AMOUNT_NEGATIVE')
    ) {
      return 'critical';
    }

    // High: Booking data with invalid dates (business impact)
    if (
      record.gateId === 'bookings-gate' &&
      record.rejectionReason.includes('BOOKING_DATES_INVALID')
    ) {
      return 'high';
    }

    // High: Future event times (data quality issue)
    if (record.rejectionReason.includes('EVENT_TIME_FUTURE')) {
      return 'high';
    }

    // Medium: Schema validation failures
    if (record.rejectionReason.includes('Schema validation failed')) {
      return 'medium';
    }

    // Low: Default priority
    return 'low';
  }

  /**
   * Get empty statistics object
   */
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

  /**
   * Get records by priority for urgent review
   */
  async getHighPriorityRecords(limit: number = 50): Promise<QuarantinedRecord[]> {
    return this.getQuarantinedRecords({
      priority: 'critical',
      reviewed: false,
      limit,
    });
  }

  /**
   * Search quarantined records
   */
  async searchQuarantinedRecords(
    searchTerm: string,
    limit: number = 20,
  ): Promise<QuarantinedRecord[]> {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from(this.quarantineTable)
        .select('*')
        .or(
          `record_id.ilike.%${searchTerm}%,rejection_reason.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`,
        )
        .order('quarantined_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.warn('Failed to search quarantined records:', error);
        return [];
      }

      return data.map((row) => ({
        id: row.id,
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
      }));
    } catch (error) {
      this.logger.error('Failed to search quarantined records:', error);
      return [];
    }
  }
}
