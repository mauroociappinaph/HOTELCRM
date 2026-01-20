// Barrel export principal del paquete shared
export * from './dtos';

// Dashboard DTOs (exported specifically to avoid conflicts)
export { DashboardDataDto, DashboardStatsDto, RecentActivityDto } from './dtos/dashboard-stats.dto';
export * from './constants';

// Core types (excluding conflicts)
export type { Booking, BookingStatus } from './types/booking.types';
export type { User, UserRole } from './types/user.types';
export type { Client } from './types/client.types';
export type { Agency } from './types/agency.types';
export type { Payment } from './types/payments.types';
export * from './types/video.types';

// TypeScript Pro - Advanced Utility Types
export * from './types/advanced-utils.types';

// Type-safe builders
export {
  TypeSafeBuilder,
  FluentBuilder,
  BookingBuilder,
  BookingData,
  TypeSafeFactory,
  RepositoryBuilder,
  createBookingBuilder,
  createRepositoryBuilder,
  createTypeSafeFactory,
} from './types/type-safe-builder';

// Repository Pattern Exports (avoiding conflicts with existing types)
export type {
  IRepository,
  IQueryRepository,
  ITransactionalRepository,
  IChatRepository,
  IBookingRepository,
  IUserRepository,
  IDocumentRepository,
  IRepositoryFactory,
  IUnitOfWork,
  ITransaction,
  QueryOptions,
  PaginationOptions,
  PaginatedResult,
  SearchQuery,
  SearchResult,
  ConversationOptions,
  BaseEntity,
  ChatSession,
  ChatMessage,
  Document,
} from './types/repository.types';
