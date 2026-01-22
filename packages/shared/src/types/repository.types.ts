/**
 * Repository Pattern Interfaces for HOTELCRM
 * Enterprise-grade data access abstractions with type safety
 */

import { Option } from './advanced-utils.types';
import { Booking, BookingStatus } from './booking.types';
import { User } from './user.types';
import {
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  MemoryQuery,
  MemoryResult,
} from './memory.types';
import { EtlRecord, EtlJob } from './etl.types';

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

export interface IMemoryRepository {
  // Episodic Memory
  storeEpisodic(
    memory: Omit<
      EpisodicMemory,
      'id' | 'createdAt' | 'updatedAt' | 'consolidationCount' | 'lastAccessed' | 'accessCount'
    >,
  ): Promise<string>;
  queryEpisodic(query: MemoryQuery): Promise<MemoryResult[]>;
  consolidateEpisodic(userId: string, agencyId: string, threshold: number): Promise<void>;

  // Semantic Memory
  storeSemantic(
    memory: Omit<SemanticMemory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>,
  ): Promise<string>;
  querySemantic(query: MemoryQuery): Promise<MemoryResult[]>;

  // Procedural Memory
  storeProcedural(
    memory: Omit<ProceduralMemory, 'id' | 'createdAt' | 'updatedAt' | 'lastUsed' | 'usageCount'>,
  ): Promise<string>;
  queryProcedural(query: MemoryQuery): Promise<MemoryResult[]>;
}

export interface IEtlRepository {
  insertBatch(
    pipelineId: string,
    table: string,
    records: EtlRecord[],
  ): Promise<{ success: number; failed: number }>;

  saveJob(job: EtlJob): Promise<void>;
  getJob(jobId: string): Promise<Option<EtlJob>>;
  updateJobStatus(jobId: string, status: EtlJob['status'], error?: string): Promise<void>;
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
  select?: string; // 🔧 OPTIMIZATION: Allow custom field selection to prevent over-fetching
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
  filters?: Record<string, unknown>;
  options?: QueryOptions;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  facets?: Record<string, unknown>;
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
  metadata: Record<string, unknown>;
  lastActivity: Date;
}

export interface ChatMessage extends BaseEntity {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
  metadata: Record<string, unknown>;
}

export interface Document extends BaseEntity {
  title: string;
  content: string;
  category: string;
  tags: string[];
  embeddings?: number[];
  metadata: Record<string, unknown>;
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
