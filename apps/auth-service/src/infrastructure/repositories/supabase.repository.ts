/**
 * Supabase Repository Implementation
 * Enterprise-grade repository pattern with security and performance optimizations
 */

import { Injectable } from '@nestjs/common';
import {
  IRepository,
  IQueryRepository,
  ITransactionalRepository,
  IChatRepository,
  IBookingRepository,
  IUserRepository,
  IDocumentRepository,
  QueryOptions,
  PaginationOptions,
  PaginatedResult,
  SearchQuery,
  SearchResult,
  ConversationOptions,
  Option,
  ChatSession,
  ChatMessage,
  Booking,
  User,
  Document,
  ITransaction,
} from '@hotel-crm/shared';

import { SupabaseService } from '../supabase/supabase.service';

/**
 * Type-safe error message extractor for Supabase errors
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error occurred';
}

/**
 * Base Supabase Repository with common CRUD operations
 */
@Injectable()
export abstract class SupabaseRepository<T extends { id: string }> implements IRepository<T> {
  constructor(
    protected readonly supabaseService: SupabaseService,
    protected readonly tableName: string,
  ) {}

  async findById(id: string): Promise<Option<T>> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return { some: false, value: undefined };
        }
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return { some: true, value: data as T };
    } catch (error) {
      throw new Error(`Failed to find ${this.tableName} by id: ${getErrorMessage(error)}`);
    }
  }

  async findAll(filter?: Partial<T>): Promise<T[]> {
    try {
      let query = this.supabaseService.getClient().from(this.tableName).select('*');

      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return (data || []) as unknown as T[];
    } catch (error) {
      throw new Error(`Failed to find all ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }

  async create(entity: Omit<T, 'id'>): Promise<T> {
    try {
      const now = new Date();
      const entityWithTimestamps = {
        ...entity,
        createdAt: now,
        updatedAt: now,
      };

      const { data, error } = await this.supabaseService
        .getClient()
        .from(this.tableName)
        .insert(entityWithTimestamps)
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return data as T;
    } catch (error) {
      throw new Error(`Failed to create ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }

  async update(id: string, entity: Partial<T>): Promise<Option<T>> {
    try {
      const updateData = {
        ...entity,
        updatedAt: new Date(),
      };

      const { data, error } = await this.supabaseService
        .getClient()
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return { some: false, value: undefined };
        }
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return { some: true, value: data as T };
    } catch (error) {
      throw new Error(`Failed to update ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to delete ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const { count, error } = await this.supabaseService
        .getClient()
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('id', id);

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return (count || 0) > 0;
    } catch (error) {
      throw new Error(`Failed to check existence in ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }

  async count(filter?: Partial<T>): Promise<number> {
    try {
      let query = this.supabaseService
        .getClient()
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      const { count, error } = await query;

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return count || 0;
    } catch (error) {
      throw new Error(`Failed to count ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }
}

/**
 * Query Repository with advanced querying capabilities
 */
@Injectable()
export abstract class SupabaseQueryRepository<T extends { id: string }>
  extends SupabaseRepository<T>
  implements IQueryRepository<T>
{
  async findOne(filter: Partial<T>): Promise<Option<T>> {
    try {
      let query = this.supabaseService.getClient().from(this.tableName).select('*');

      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return { some: false, value: undefined };
        }
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return { some: true, value: data as T };
    } catch (error) {
      throw new Error(`Failed to find one ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }

  async findMany(filter: Partial<T>, options?: QueryOptions): Promise<T[]> {
    try {
      // 🔧 OPTIMIZATION: Allow custom select fields to prevent over-fetching
      const selectFields = options?.select || '*';
      let query = this.supabaseService.getClient().from(this.tableName).select(selectFields);

      // Apply filters
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      // Apply options
      if (options?.orderBy) {
        options.orderBy.forEach((order: { field: string; direction: 'asc' | 'desc' }) => {
          query = query.order(order.field, { ascending: order.direction === 'asc' });
        });
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return (data || []) as unknown as T[];
    } catch (error) {
      throw new Error(`Failed to find many ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }

  async paginate(filter: Partial<T>, options: PaginationOptions): Promise<PaginatedResult<T>> {
    try {
      const offset = (options.page - 1) * options.pageSize;
      const limit = options.pageSize;

      // Get total count
      const total = await this.count(filter);

      // Get paginated data
      const data = await this.findMany(filter, {
        ...options,
        offset,
        limit,
      });

      const totalPages = Math.ceil(total / options.pageSize);

      return {
        data,
        pagination: {
          page: options.page,
          pageSize: options.pageSize,
          total,
          totalPages,
          hasNext: options.page < totalPages,
          hasPrev: options.page > 1,
        },
      };
    } catch (error) {
      throw new Error(`Failed to paginate ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }

  async search(query: SearchQuery): Promise<SearchResult<T>> {
    try {
      // For now, implement basic search. In production, this would use full-text search
      let dbQuery = this.supabaseService
        .getClient()
        .from(this.tableName)
        .select('*', { count: 'exact' });

      // Apply text search if fields specified
      if (query.fields && query.fields.length > 0) {
        // Sanitize query to prevent PostgREST injection
        const sanitizedQuery = query.query.replace(/[(),]/g, '');
        const searchConditions = query.fields.map(
          (field: string) => `${field}.ilike.%${sanitizedQuery}%`,
        );
        // Note: This is a simplified implementation. Real full-text search would be more complex
        dbQuery = dbQuery.or(searchConditions.join(','));
      }

      // Apply filters
      if (query.filters) {
        Object.entries(query.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            dbQuery = dbQuery.eq(key, value);
          }
        });
      }

      // Apply options
      if (query.options?.limit) {
        dbQuery = dbQuery.limit(query.options.limit);
      }

      const { data, error, count } = await dbQuery;

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return {
        items: (data || []) as T[],
        total: count || 0,
      };
    } catch (error) {
      throw new Error(`Failed to search ${this.tableName}: ${getErrorMessage(error)}`);
    }
  }
}

/**
 * Specialized Chat Repository Implementation
 */
@Injectable()
export class SupabaseChatRepository
  extends SupabaseQueryRepository<ChatSession>
  implements IChatRepository
{
  constructor(supabaseService: SupabaseService) {
    super(supabaseService, 'ai_chat_sessions');
  }

  async findByUserId(userId: string): Promise<ChatSession[]> {
    return this.findMany({ userId } as any, {
      orderBy: [{ field: 'lastActivity', direction: 'desc' }],
    });
  }

  async findActiveSession(userId: string): Promise<Option<ChatSession>> {
    return this.findOne({
      userId,
      status: 'active',
    } as any);
  }

  async saveMessage(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      const messageWithSessionId = {
        ...message,
        sessionId,
      };

      const { error } = await this.supabaseService
        .getClient()
        .from('ai_chat_messages')
        .insert(messageWithSessionId);

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      // Update session last activity
      await this.supabaseService
        .getClient()
        .from(this.tableName)
        .update({ lastActivity: new Date() })
        .eq('id', sessionId);
    } catch (error) {
      throw new Error(`Failed to save message: ${getErrorMessage(error)}`);
    }
  }

  async getConversationHistory(
    sessionId: string,
    options?: ConversationOptions,
  ): Promise<ChatMessage[]> {
    try {
      let query = this.supabaseService
        .getClient()
        .from('ai_chat_messages')
        .select('*')
        .eq('sessionId', sessionId);

      if (options?.before) {
        query = query.lt('createdAt', options.before);
      }

      if (options?.after) {
        query = query.gt('createdAt', options.after);
      }

      if (!options?.includeSystemMessages) {
        query = query.neq('role', 'system');
      }

      query = query.order('createdAt', { ascending: true });

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return (data || []) as ChatMessage[];
    } catch (error) {
      throw new Error(`Failed to get conversation history: ${getErrorMessage(error)}`);
    }
  }
}

/**
 * Specialized Booking Repository Implementation
 */
@Injectable()
export class SupabaseBookingRepository
  extends SupabaseQueryRepository<Booking>
  implements IBookingRepository
{
  constructor(supabaseService: SupabaseService) {
    super(supabaseService, 'bookings');
  }

  async findByUserId(userId: string): Promise<Booking[]> {
    return this.findMany({ userId } as any, {
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
    });
  }

  async findByRoomId(roomId: string): Promise<Booking[]> {
    return this.findMany({ roomId } as any, {
      orderBy: [{ field: 'checkInDate', direction: 'asc' }],
    });
  }

  async findConflictingBookings(roomId: string, checkIn: Date, checkOut: Date): Promise<Booking[]> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from(this.tableName)
        .select('*')
        .eq('roomId', roomId)
        .or(
          `and(checkInDate.lt.${checkOut.toISOString()},checkOutDate.gt.${checkIn.toISOString()})`,
        );

      if (error) {
        throw new Error(`Database error: ${getErrorMessage(error)}`);
      }

      return (data || []) as Booking[];
    } catch (error) {
      throw new Error(`Failed to find conflicting bookings: ${getErrorMessage(error)}`);
    }
  }

  async updateStatus(id: string, status: any): Promise<Option<Booking>> {
    return this.update(id, { status });
  }
}

/**
 * Specialized User Repository Implementation
 */
@Injectable()
export class SupabaseUserRepository
  extends SupabaseQueryRepository<User>
  implements IUserRepository
{
  constructor(supabaseService: SupabaseService) {
    super(supabaseService, 'users');
  }

  async findByEmail(email: string): Promise<Option<User>> {
    return this.findOne({ email } as any);
  }

  async findByAgencyId(agencyId: string): Promise<User[]> {
    return this.findMany({ agencyId } as any, {
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
    });
  }

  async updateLastLogin(id: string): Promise<Option<User>> {
    return this.update(id, { lastLoginAt: new Date() } as any);
  }
}

/**
 * Specialized Document Repository Implementation
 */
@Injectable()
export class SupabaseDocumentRepository
  extends SupabaseQueryRepository<Document>
  implements IDocumentRepository
{
  constructor(supabaseService: SupabaseService) {
    super(supabaseService, 'ai_documents');
  }

  async findByCategory(category: string): Promise<Document[]> {
    return this.findMany({ category } as any, {
      orderBy: [{ field: 'createdAt', direction: 'desc' }],
    });
  }

  async searchByContent(query: string): Promise<Document[]> {
    return this.search({
      query,
      fields: ['title', 'content'],
    }).then((result) => result.items);
  }

  async findSimilar(documentId: string, limit = 10): Promise<Document[]> {
    try {
      // This would typically use vector similarity search
      // For now, return recent documents from same category
      const { data: targetDoc, error: targetError } = await this.supabaseService
        .getClient()
        .from(this.tableName)
        .select('category')
        .eq('id', documentId)
        .single();

      if (targetError || !targetDoc) {
        return [];
      }

      return this.findMany({ category: targetDoc.category } as any, {
        limit,
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
      });
    } catch (error) {
      throw new Error(`Failed to find similar documents: ${getErrorMessage(error)}`);
    }
  }
}
