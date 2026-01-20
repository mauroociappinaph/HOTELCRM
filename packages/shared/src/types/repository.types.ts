/**
 * Repository Pattern Interfaces for HOTELCRM
 * Enterprise-grade data access abstractions with type safety
 */

import { Option, Result } from './advanced-utils.types';
import { Booking, BookingStatus } from './booking.types';
import { User, UserRole } from './user.types';
import { Agency, Client, Payment } from './index';

/**
 * Base repository interface with CRUD operations
 */
export interface IRepository<T extends { id: string }, TId = string> {
  findById(id: TId): Promise<Option<T>>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: TId, entity: Partial<T>): Promise<Option<T>>;
  delete(id: TId): Promise<boolean>;
  exists(id: TId): Promise<boolean>;
  count(filter?: Partial<T>): Promise<number>;
}

/**
 * Advanced repository with query capabilities
 */
export interface IQueryRepository<T extends { id: string }> extends IRepository<T> {
  findOne(filter: Partial<T>): Promise<Option<T>>;
  findMany(filter: Partial<T>, options?: QueryOptions): Promise<T[]>;
  paginate(filter: Partial<T>, options: PaginationOptions): Promise<PaginatedResult<T>>;
  search(query: SearchQuery): Promise<SearchResult<T>>;
}

/**
 * Transaction support for repositories
 */
export interface ITransactionalRepository<T extends { id: string }> extends IRepository<T> {
  beginTransaction(): Promise<ITransaction>;
  executeInTransaction<T>(operation: (repo: this) => Promise<T>): Promise<T>;
}

/**
 * Specialized repository interfaces for domain objects
 */

export interface IChatRepository extends IQueryRepository<ChatSession> {
  findByUserId(userId: string): Promise<ChatSession[]>;
  findActiveSession(userId: string): Promise<Option<ChatSession>>;
  saveMessage(sessionId: string, message: ChatMessage): Promise<void>;
  getConversationHistory(sessionId: string, options?: ConversationOptions): Promise<ChatMessage[]>;
}

export interface IBookingRepository extends IQueryRepository<Booking> {
  findByUserId(userId: string): Promise<Booking[]>;
  findByRoomId(roomId: string): Promise<Booking[]>;
  findConflictingBookings(roomId: string, checkIn: Date, checkOut: Date): Promise<Booking[]>;
  updateStatus(id: string, status: BookingStatus): Promise<Option<Booking>>;
}

export interface IUserRepository extends IQueryRepository<User> {
  findByEmail(email: string): Promise<Option<User>>;
  findByAgencyId(agencyId: string): Promise<User[]>;
  updateLastLogin(id: string): Promise<Option<User>>;
}

export interface IDocumentRepository extends IQueryRepository<Document> {
  findByCategory(category: string): Promise<Document[]>;
  searchByContent(query: string): Promise<Document[]>;
  findSimilar(documentId: string, limit?: number): Promise<Document[]>;
}

/**
 * Data Transfer Objects and supporting types
 */

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  include?: string[];
  exclude?: string[];
}

export interface PaginationOptions extends QueryOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SearchQuery {
  query: string;
  fields?: string[];
  filters?: Record<string, any>;
  options?: QueryOptions;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  facets?: Record<string, any>;
  suggestions?: string[];
}

export interface ConversationOptions {
  limit?: number;
  before?: Date;
  after?: Date;
  includeSystemMessages?: boolean;
}

/**
 * Transaction interface for atomic operations
 */
export interface ITransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  isActive(): boolean;
}

/**
 * Domain Entities (simplified for repository interfaces)
 */

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSession extends BaseEntity {
  userId: string;
  agencyId: string;
  title?: string;
  status: 'active' | 'closed' | 'archived';
  metadata: Record<string, any>;
  lastActivity: Date;
}

export interface ChatMessage extends BaseEntity {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
  metadata: Record<string, any>;
}

export interface Document extends BaseEntity {
  title: string;
  content: string;
  category: string;
  tags: string[];
  embeddings?: number[];
  metadata: Record<string, any>;
}

/**
 * Repository Factory for dependency injection
 */
export interface IRepositoryFactory {
  createChatRepository(): IChatRepository;
  createBookingRepository(): IBookingRepository;
  createUserRepository(): IUserRepository;
  createDocumentRepository(): IDocumentRepository;
}

/**
 * Unit of Work pattern for managing multiple repositories
 */
export interface IUnitOfWork {
  chatRepository: IChatRepository;
  bookingRepository: IBookingRepository;
  userRepository: IUserRepository;
  documentRepository: IDocumentRepository;

  beginTransaction(): Promise<ITransaction>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  dispose(): Promise<void>;
}
