// Barrel export principal del paquete shared
export * from './types';
export * from './dtos';
export * from './constants';

// TypeScript Pro - Advanced Utility Types
export * from './types/advanced-utils.types';
// Export specific types to avoid conflicts with existing types
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
