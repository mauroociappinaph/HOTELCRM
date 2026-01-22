import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

import { DataSourceMetadata, EtlRecord, IngestionFilters } from './interfaces/etl.interface';

export interface DataSource {
  type: 'database' | 'api' | 'file' | 'stream';
  connectionString?: string;
  tableName?: string;
  apiEndpoint?: string;
  filePath?: string;
  streamTopic?: string;
}

@Injectable()
export class DataIngestionService {
  private readonly logger = new Logger(DataIngestionService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Ingest data from various sources
   */
  async ingestData(source: DataSource, filters?: IngestionFilters): Promise<EtlRecord[]> {
    switch (source.type) {
      case 'database':
        return this.ingestFromDatabase(source, filters);
      case 'api':
        return this.ingestFromApi(source, filters);
      case 'file':
        return this.ingestFromFile(source, filters);
      case 'stream':
        return this.ingestFromStream(source, filters);
      default:
        throw new Error(`Unsupported data source type: ${source.type}`);
    }
  }

  /**
   * Ingest data from database
   */
  private async ingestFromDatabase(
    source: DataSource,
    filters?: IngestionFilters,
  ): Promise<EtlRecord[]> {
    const client = this.supabaseService.getClient();

    if (!source.tableName) {
      throw new Error('Table name is required for database ingestion');
    }

    let query = client.from(source.tableName).select('*');

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (key !== 'startDate' && key !== 'endDate' && key !== 'categories' && key !== 'status') {
          query = query.eq(key, value);
        }
      });
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Database ingestion error for table ${source.tableName}:`, error);
      throw error;
    }

    this.logger.log(`📊 Ingested ${data?.length || 0} records from table: ${source.tableName}`);

    return (data || []).map((record) => this.mapToEtlRecord(record, source.tableName!));
  }

  /**
   * Ingest data from API
   */
  private async ingestFromApi(
    source: DataSource,
    filters?: IngestionFilters,
  ): Promise<EtlRecord[]> {
    if (!source.apiEndpoint) {
      throw new Error('API endpoint is required for API ingestion');
    }

    try {
      const response = await fetch(source.apiEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers if needed
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const rawData = (await response.json()) as
        | Record<string, unknown>
        | Array<Record<string, unknown>>;

      // Handle different response formats
      const records = Array.isArray(rawData)
        ? rawData
        : ((rawData as Record<string, unknown>).data as Array<Record<string, unknown>>) || [
            rawData,
          ];

      this.logger.log(`🌐 Ingested ${records.length} records from API: ${source.apiEndpoint}`);

      return records.map((record: Record<string, unknown>) =>
        this.mapToEtlRecord(record, source.apiEndpoint!),
      );
    } catch (error) {
      this.logger.error(`API ingestion error for endpoint ${source.apiEndpoint}:`, error);
      throw error;
    }
  }

  /**
   * Ingest data from file
   */
  private async ingestFromFile(
    source: DataSource,
    filters?: IngestionFilters,
  ): Promise<EtlRecord[]> {
    if (!source.filePath) {
      throw new Error('File path is required for file ingestion');
    }

    // For now, return empty array - file ingestion would require additional dependencies
    this.logger.warn(`📁 File ingestion not implemented yet for path: ${source.filePath}`);
    return [];
  }

  /**
   * Ingest data from stream
   */
  private async ingestFromStream(
    source: DataSource,
    filters?: IngestionFilters,
  ): Promise<EtlRecord[]> {
    if (!source.streamTopic) {
      throw new Error('Stream topic is required for stream ingestion');
    }

    // For now, return empty array - streaming would require Kafka/Redis/etc.
    this.logger.warn(`🌊 Stream ingestion not implemented yet for topic: ${source.streamTopic}`);
    return [];
  }

  /**
   * Validate data source configuration
   */
  validateDataSource(source: DataSource): boolean {
    switch (source.type) {
      case 'database':
        return !!source.tableName;
      case 'api':
        return !!source.apiEndpoint;
      case 'file':
        return !!source.filePath;
      case 'stream':
        return !!source.streamTopic;
      default:
        return false;
    }
  }

  /**
   * Get data source metadata
   */
  async getDataSourceMetadata(source: DataSource): Promise<DataSourceMetadata> {
    const metadata: DataSourceMetadata = {
      type: source.type,
      validated: this.validateDataSource(source),
      timestamp: new Date().toISOString(),
    };

    if (source.type === 'database' && source.tableName) {
      try {
        const client = this.supabaseService.getClient();
        const { count } = await client
          .from(source.tableName)
          .select('*', { count: 'exact', head: true });

        metadata.totalRecords = count ?? undefined;
      } catch (error) {
        const err = error as Error;
        metadata.error = err?.message || 'Unknown error';
      }
    }

    return metadata;
  }

  /**
   * Helper to map raw data to EtlRecord
   */
  private mapToEtlRecord(data: Record<string, unknown>, source: string): EtlRecord {
    return {
      id: (data.id as string) || (data._id as string) || crypto.randomUUID(),
      eventTime: data.updated_at ? new Date(data.updated_at as string) : new Date(),
      processingTime: new Date(),
      data,
      source,
    };
  }
}
