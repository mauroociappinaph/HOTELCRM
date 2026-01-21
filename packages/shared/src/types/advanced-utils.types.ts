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
export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

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
  message?: string,
): asserts value is T {
  if (!guard(value)) {
    throw new Error(
      message || `Type assertion failed: expected ${guard.name}, got ${typeof value}`,
    );
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
  predicate: (item: T) => item is S,
): S[] {
  return array.filter(predicate);
}

/**
 * Type-safe group by operation
 */
export function groupBy<T, K extends string | number>(
  array: readonly T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return array.reduce(
    (groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    },
    {} as Record<K, T[]>,
  );
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

// All types are already exported above as interfaces and type aliases
