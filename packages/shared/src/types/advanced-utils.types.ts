/**
 * Advanced TypeScript Utility Types for HOTELCRM Enterprise
 * Using TypeScript Pro patterns: Generics, Conditional Types, Mapped Types, Template Literals
 */

// ==========================================
// 🔧 CORE UTILITY TYPES
// ==========================================

/**
 * Deep readonly - recursively makes all properties readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Deep partial - recursively makes all properties optional
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract keys of properties that are functions
 */
export type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * Extract keys of properties that are not functions
 */
export type NonFunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

/**
 * Make specific keys optional while keeping others required
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific keys required while keeping others as they are
 */
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ==========================================
// 🎯 CONDITIONAL TYPES & TYPE LOGIC
// ==========================================

/**
 * Check if type is an array and extract element type
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Extract return type from function type
 */
export type ReturnTypeOf<T> = T extends (...args: any[]) => infer R ? R : never;

/**
 * Extract parameters from function type
 */
export type ParametersOf<T> = T extends (...args: infer P) => any ? P : never;

/**
 * Check if two types are exactly equal
 */
export type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

/**
 * Flatten nested arrays
 */
export type Flatten<T> = T extends (infer U)[] ? (U extends any[] ? Flatten<U> : U) : T;

/**
 * Get union of all values in an object
 */
export type ValueOf<T> = T[keyof T];

/**
 * Extract string literal types from object keys
 */
export type StringKeys<T> = Extract<keyof T, string>;

// ==========================================
// 🏗️ ENTERPRISE PATTERNS
// ==========================================

/**
 * Builder Pattern with type safety - ensures required properties are set
 */
export type BuilderState = 'incomplete' | 'complete';

export interface Builder<T, State extends BuilderState = 'incomplete'> {
  build(): State extends 'complete' ? T : never;
}

/**
 * Type-safe Result/Option pattern (Rust-inspired)
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

export type Option<T> = { some: true; value: T } | { some: false; value: undefined };

/**
 * Type-safe Event Emitter with discriminated unions
 */
export interface TypedEventEmitter<TEvents extends Record<string, any>> {
  on<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): void;
  off<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void): void;
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void;
}

/**
 * Repository Pattern with generic constraints
 */
export interface Repository<T, TId = string> {
  findById(id: TId): Promise<Option<T>>;
  findAll(filter?: Partial<T>): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: TId, entity: Partial<T>): Promise<Option<T>>;
  delete(id: TId): Promise<boolean>;
}

/**
 * CQRS Pattern types
 */
export interface Command<T = any> {
  readonly type: string;
  readonly payload: T;
  readonly metadata?: Record<string, any>;
}

export interface Query<T = any> {
  readonly type: string;
  readonly payload: T;
  readonly metadata?: Record<string, any>;
}

export interface CommandHandler<TCommand extends Command, TResult = void> {
  execute(command: TCommand): Promise<TResult>;
}

export interface QueryHandler<TQuery extends Query, TResult> {
  execute(query: TQuery): Promise<TResult>;
}

// ==========================================
// 🔍 TYPE GUARDS & ASSERTIONS
// ==========================================

/**
 * Type guard that narrows type and throws if invalid
 */
export function assertType<T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  message?: string
): asserts value is T {
  if (!guard(value)) {
    throw new Error(message || `Type assertion failed: expected ${guard.name}, got ${typeof value}`);
  }
}

/**
 * Type guard for arrays
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Type guard for non-null values
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Type guard for strings
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for numbers
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard for objects (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ==========================================
// 🏨 HOTELCRM SPECIFIC TYPES
// ==========================================

/**
 * Booking status with discriminated unions
 */
export type BookingStatus =
  | { status: 'pending'; reason?: string }
  | { status: 'confirmed'; confirmationCode: string }
  | { status: 'checked_in'; roomNumber: string }
  | { status: 'checked_out'; finalAmount: number }
  | { status: 'cancelled'; reason: string; refundAmount?: number };

/**
 * Payment method discriminated unions
 */
export type PaymentMethod =
  | { type: 'credit_card'; cardNumber: string; expiryDate: string; cvv: string }
  | { type: 'debit_card'; cardNumber: string; expiryDate: string; cvv: string }
  | { type: 'paypal'; email: string }
  | { type: 'bank_transfer'; accountNumber: string; routingNumber: string }
  | { type: 'cash'; receivedBy: string };

/**
 * User roles with permissions
 */
export type UserRole = 'guest' | 'customer' | 'agency_staff' | 'agency_admin' | 'system_admin';

export type RolePermissions = {
  [K in UserRole]: string[];
};

/**
 * API Response wrapper with generic success/error states
 */
export interface ApiResponse<TData = any, TError = string> {
  success: boolean;
  data?: TData;
  error?: TError;
  metadata?: {
    timestamp: Date;
    requestId: string;
    processingTime: number;
  };
}

/**
 * Pagination types with cursor-based pagination
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
    cursor?: string;
  };
}

/**
 * Search filter builder with type safety
 */
export interface SearchFilter<T> {
  where?: Partial<T>;
  orderBy?: { [K in keyof T]?: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
  include?: Array<keyof T>;
  exclude?: Array<keyof T>;
}

// ==========================================
// 🎭 ADVANCED GENERICS
// ==========================================

/**
 * Generic CRUD operations with constraints
 */
export interface CrudOperations<T extends { id: string }, TCreate = Omit<T, 'id'>, TUpdate = Partial<TCreate>> {
  create(data: TCreate): Promise<T>;
  read(id: string): Promise<Option<T>>;
  update(id: string, data: TUpdate): Promise<Option<T>>;
  delete(id: string): Promise<boolean>;
  list(filter?: SearchFilter<T>): Promise<PaginatedResponse<T>>;
}

/**
 * Generic Service with dependency injection constraints
 */
export interface Service<TConfig = any, TDependencies extends Record<string, any> = {}> {
  initialize(config: TConfig, dependencies: TDependencies): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  health(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }>;
}

/**
 * Plugin system with type-safe registration
 */
export interface Plugin<TConfig = any, TContext = any> {
  name: string;
  version: string;
  config: TConfig;
  initialize(context: TContext): Promise<void>;
  execute(input: any): Promise<any>;
}

/**
 * Middleware chain with type composition
 */
export type Middleware<TInput, TOutput> = (input: TInput, next: (input: TInput) => Promise<TOutput>) => Promise<TOutput>;

export type MiddlewareChain<TInput, TOutput> = Middleware<TInput, TOutput>[];

// ==========================================
// 🔐 TYPE-SAFE CONFIGURATION
// ==========================================

/**
 * Configuration with validation constraints
 */
export interface ConfigSchema<T> {
  validate(value: unknown): value is T;
  defaultValue: T;
  description?: string;
  required?: boolean;
}

/**
 * Environment variable parser with type safety
 */
export interface EnvParser<T> {
  parse(value: string | undefined): T;
  validate(value: unknown): value is T;
  description: string;
  defaultValue?: T;
  required: boolean;
}

// ==========================================
// 📊 METRICS & MONITORING TYPES
// ==========================================

/**
 * Metric types with tagged unions
 */
export type MetricValue =
  | { type: 'counter'; value: number }
  | { type: 'gauge'; value: number }
  | { type: 'histogram'; values: number[]; buckets: number[] }
  | { type: 'summary'; count: number; sum: number; quantiles: Record<number, number> };

export interface Metric {
  name: string;
  value: MetricValue;
  labels: Record<string, string>;
  timestamp: Date;
  description?: string;
}

/**
 * Health check with detailed status
 */
export interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration: number;
  }>;
  uptime: number;
  version: string;
}

// ==========================================
// 🎯 UTILITY FUNCTIONS WITH TYPE SAFETY
// ==========================================

/**
 * Type-safe object property getter
 */
export function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

/**
 * Simple object merge (shallow)
 */
export function mergeObjects<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  return { ...target, ...source };
}

/**
 * Type-safe array filtering with predicate
 */
export function filterArray<T, S extends T>(
  array: readonly T[],
  predicate: (item: T) => item is S
): S[] {
  return array.filter(predicate);
}

/**
 * Type-safe group by operation
 */
export function groupBy<T, K extends string | number>(
  array: readonly T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
}

// ==========================================
// 🚨 ERROR HANDLING TYPES
// ==========================================

/**
 * Discriminated error types
 */
export type AppError =
  | { type: 'validation'; field: string; message: string }
  | { type: 'not_found'; resource: string; id: string }
  | { type: 'unauthorized'; action: string; resource: string }
  | { type: 'conflict'; resource: string; message: string }
  | { type: 'internal'; message: string; stack?: string };

/**
 * Error boundary with typed errors
 */
export interface ErrorBoundary<TError = Error> {
  catch(error: TError): void;
  rethrow(): never;
  hasError(): boolean;
  getError(): TError | undefined;
}

// ==========================================
// 🎨 DOMAIN SPECIFIC UTILITIES
// ==========================================

/**
 * Type-safe date range validation
 */
export interface DateRange {
  start: Date;
  end: Date;
}

export function isValidDateRange(range: DateRange): boolean {
  return range.start <= range.end;
}

/**
 * Currency amount with validation
 */
export interface Money {
  amount: number;
  currency: string;
}

export function validateMoney(money: Money): boolean {
  return money.amount >= 0 && typeof money.currency === 'string' && money.currency.length === 3;
}

/**
 * Room type with constraints
 */
export type RoomType = 'single' | 'double' | 'suite' | 'deluxe' | 'presidential';

export type RoomCapacity = {
  [K in RoomType]: number;
};

// All types are already exported above as interfaces and type aliases
