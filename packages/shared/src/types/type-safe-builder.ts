/**
 * Type-Safe Builder Pattern for HOTELCRM
 * Using TypeScript Pro advanced patterns with conditional types and generics
 */

import {
  Builder,
  BuilderState,
  DeepPartial,
  RequiredKeys,
  OptionalKeys,
} from './advanced-utils.types';

/**
 * Generic Builder class with type safety
 */
export class TypeSafeBuilder<T extends Record<string, any>, Required extends keyof T = never> {
  private data: Partial<T> = {};
  private requiredFields: Set<keyof T> = new Set();

  constructor(required: Required[] = []) {
    required.forEach((field) => this.requiredFields.add(field));
  }

  /**
   * Set a property value with type checking
   */
  set<K extends keyof T>(key: K, value: T[K]): this {
    this.data[key] = value;
    return this;
  }

  /**
   * Set multiple properties at once
   */
  setMany(properties: Partial<T>): this {
    Object.assign(this.data, properties);
    return this;
  }

  /**
   * Conditionally set a property
   */
  setIf<K extends keyof T>(condition: boolean, key: K, value: T[K]): this {
    if (condition) {
      this.data[key] = value;
    }
    return this;
  }

  /**
   * Get current value of a property
   */
  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.data[key];
  }

  /**
   * Check if a property is set
   */
  has<K extends keyof T>(key: K): boolean {
    return key in this.data;
  }

  /**
   * Remove a property
   */
  unset<K extends keyof T>(key: K): this {
    delete this.data[key];
    return this;
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.data = {};
    return this;
  }

  /**
   * Build the object with validation
   */
  build(): T {
    // Check required fields
    for (const field of this.requiredFields) {
      if (!(field in this.data)) {
        throw new Error(`Required field '${String(field)}' is not set`);
      }
    }

    return this.data as T;
  }

  /**
   * Build partial object (ignores required fields)
   */
  buildPartial(): Partial<T> {
    return { ...this.data };
  }

  /**
   * Clone the builder
   */
  clone(): TypeSafeBuilder<T, Required> {
    const cloned = new TypeSafeBuilder<T, Required>(Array.from(this.requiredFields) as Required[]);
    cloned.data = { ...this.data };
    return cloned;
  }
}

/**
 * Fluent API Builder with method chaining
 */
export class FluentBuilder<T extends Record<string, any>, Required extends keyof T = never> {
  private builder: TypeSafeBuilder<T, Required>;

  constructor(required: Required[] = []) {
    this.builder = new TypeSafeBuilder<T, Required>(required);
  }

  /**
   * Create fluent methods for each property
   */
  static create<T extends Record<string, any>, Required extends keyof T = never>(
    required: Required[] = [],
  ): FluentBuilder<T, Required> & {
    [K in keyof T]: (value: T[K]) => FluentBuilder<T, Required>;
  } {
    const instance = new FluentBuilder<T, Required>(required);

    // Create fluent methods dynamically
    const proxy = new Proxy(instance, {
      get(target, prop) {
        if (prop in target) {
          return target[prop as keyof typeof target];
        }

        // Create fluent setter method
        return (value: any) => {
          target.builder.set(prop as keyof T, value);
          return proxy;
        };
      },
    });

    return proxy as any;
  }

  /**
   * Set multiple properties
   */
  with(properties: Partial<T>): this {
    this.builder.setMany(properties);
    return this;
  }

  /**
   * Build the object
   */
  build(): T {
    return this.builder.build();
  }

  /**
   * Build partial object
   */
  buildPartial(): Partial<T> {
    return this.builder.buildPartial();
  }
}

/**
 * Builder for HOTELCRM Booking with strict type safety
 */
export interface BookingData {
  id: string;
  guestName: string;
  email: string;
  phone?: string;
  roomType: 'single' | 'double' | 'suite' | 'deluxe' | 'presidential';
  checkInDate: Date;
  checkOutDate: Date;
  guestCount: number;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  paymentMethod?: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer' | 'cash';
  specialRequests?: string;
  agencyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BookingBuilder extends TypeSafeBuilder<
  BookingData,
  | 'guestName'
  | 'email'
  | 'roomType'
  | 'checkInDate'
  | 'checkOutDate'
  | 'guestCount'
  | 'totalAmount'
  | 'currency'
  | 'agencyId'
> {
  constructor() {
    super([
      'guestName',
      'email',
      'roomType',
      'checkInDate',
      'checkOutDate',
      'guestCount',
      'totalAmount',
      'currency',
      'agencyId',
    ]);

    // Set defaults
    this.set('id', `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
      .set('status', 'pending')
      .set('createdAt', new Date())
      .set('updatedAt', new Date());
  }

  /**
   * Validate date range
   */
  validateDates(): this {
    const checkIn = this.get('checkInDate');
    const checkOut = this.get('checkOutDate');

    if (checkIn && checkOut && checkIn >= checkOut) {
      throw new Error('Check-out date must be after check-in date');
    }

    return this;
  }

  /**
   * Calculate total amount based on room type and nights
   */
  calculateTotal(roomRates: Record<string, number>): this {
    const roomType = this.get('roomType');
    const checkIn = this.get('checkInDate');
    const checkOut = this.get('checkOutDate');

    if (roomType && checkIn && checkOut) {
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const ratePerNight = roomRates[roomType] || 100;
      const total = nights * ratePerNight;

      this.set('totalAmount', total);
    }

    return this;
  }

  /**
   * Set guest information
   */
  guest(name: string, email: string, phone?: string): this {
    return this.set('guestName', name).set('email', email).setIf(!!phone, 'phone', phone!);
  }

  /**
   * Set booking dates
   */
  dates(checkIn: Date, checkOut: Date): this {
    return this.set('checkInDate', checkIn).set('checkOutDate', checkOut);
  }

  /**
   * Set room details
   */
  room(type: BookingData['roomType'], guestCount: number): this {
    return this.set('roomType', type).set('guestCount', guestCount);
  }

  /**
   * Set payment method
   */
  payment(method: NonNullable<BookingData['paymentMethod']>): this {
    return this.set('paymentMethod', method);
  }

  /**
   * Add special requests
   */
  specialRequests(requests: string): this {
    return this.set('specialRequests', requests);
  }

  /**
   * Override build to include validation
   */
  override build(): BookingData {
    this.validateDates();
    return super.build();
  }
}

/**
 * Factory pattern with type safety
 */
export class TypeSafeFactory<T extends Record<string, any>, TConfig = any> {
  private creators: Map<string, (config: TConfig) => T> = new Map();

  /**
   * Register a creator function
   */
  register(type: string, creator: (config: TConfig) => T): this {
    this.creators.set(type, creator);
    return this;
  }

  /**
   * Create instance by type
   */
  create(type: string, config: TConfig): T {
    const creator = this.creators.get(type);
    if (!creator) {
      throw new Error(`Unknown type: ${type}`);
    }
    return creator(config);
  }

  /**
   * Check if type is registered
   */
  hasType(type: string): boolean {
    return this.creators.has(type);
  }

  /**
   * Get all registered types
   */
  getTypes(): string[] {
    return Array.from(this.creators.keys());
  }
}

/**
 * Generic Repository Builder
 */
export class RepositoryBuilder<T extends { id: string }> {
  private filters: Array<(item: T) => boolean> = [];
  private sorters: Array<(a: T, b: T) => number> = [];
  private limitValue?: number;
  private offsetValue = 0;

  /**
   * Add filter condition
   */
  where(predicate: (item: T) => boolean): this {
    this.filters.push(predicate);
    return this;
  }

  /**
   * Add sorting
   */
  orderBy(comparator: (a: T, b: T) => number): this {
    this.sorters.push(comparator);
    return this;
  }

  /**
   * Set limit
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * Set offset
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * Execute query on data
   */
  execute(data: T[]): T[] {
    let result = data.filter((item) => this.filters.every((filter) => filter(item)));

    // Apply sorting
    for (const sorter of this.sorters) {
      result = result.sort(sorter);
    }

    // Apply pagination
    if (this.offsetValue > 0) {
      result = result.slice(this.offsetValue);
    }

    if (this.limitValue !== undefined) {
      result = result.slice(0, this.limitValue);
    }

    return result;
  }

  /**
   * Reset builder
   */
  reset(): this {
    this.filters = [];
    this.sorters = [];
    this.limitValue = undefined;
    this.offsetValue = 0;
    return this;
  }
}

// Export convenience functions
export function createBookingBuilder(): BookingBuilder {
  return new BookingBuilder();
}

export function createRepositoryBuilder<T extends { id: string }>(): RepositoryBuilder<T> {
  return new RepositoryBuilder<T>();
}

export function createTypeSafeFactory<
  T extends Record<string, any>,
  TConfig = any,
>(): TypeSafeFactory<T, TConfig> {
  return new TypeSafeFactory<T, TConfig>();
}
