import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';

import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DataLoaderService {
  // DataLoader for batch loading clients by ID
  private clientLoader!: DataLoader<string, any>;

  // DataLoader for batch loading bookings by user ID
  private userBookingsLoader!: DataLoader<string, any[]>;

  // DataLoader for batch loading itineraries by client ID
  private clientItinerariesLoader!: DataLoader<string, any[]>;

  constructor(private readonly supabaseService: SupabaseService) {
    this.initializeLoaders();
  }

  private initializeLoaders(): void {
    // 🔧 OPTIMIZATION: Batch load clients to prevent N+1 queries
    this.clientLoader = new DataLoader(async (clientIds: readonly string[]) => {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('clients')
        .select('id, first_name, last_name, email, phone')
        .in('id', clientIds as string[]);

      if (error) {
        throw error;
      }

      // Map results back to the requested IDs
      const clientMap = new Map(data?.map((client: any) => [client.id, client]) || []);
      return clientIds.map((id) => clientMap.get(id) || null);
    });

    // 🔧 OPTIMIZATION: Batch load bookings by user ID
    this.userBookingsLoader = new DataLoader(async (userIds: readonly string[]) => {
      const client = this.supabaseService.getClient();

      // Get all bookings for all requested users in one query
      const { data, error } = await client
        .from('bookings')
        .select('id, user_id, client_id, status, total_amount, check_in_date, check_out_date')
        .in('user_id', userIds as string[])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Group bookings by user_id
      const bookingsByUser = new Map<string, any[]>();
      data?.forEach((booking: any) => {
        const userId = booking.user_id;
        if (!bookingsByUser.has(userId)) {
          bookingsByUser.set(userId, []);
        }
        bookingsByUser.get(userId)!.push(booking);
      });

      // Return bookings array for each requested user
      return userIds.map((userId) => bookingsByUser.get(userId) || []);
    });

    // 🔧 OPTIMIZATION: Batch load itineraries by client ID
    this.clientItinerariesLoader = new DataLoader(async (clientIds: readonly string[]) => {
      const client = this.supabaseService.getClient();

      const { data, error } = await client
        .from('itineraries')
        .select('id, client_id, title, start_date, end_date')
        .in('client_id', clientIds as string[])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Group itineraries by client_id
      const itinerariesByClient = new Map<string, any[]>();
      data?.forEach((itinerary: any) => {
        const clientId = itinerary.client_id;
        if (!itinerariesByClient.has(clientId)) {
          itinerariesByClient.set(clientId, []);
        }
        itinerariesByClient.get(clientId)!.push(itinerary);
      });

      return clientIds.map((clientId) => itinerariesByClient.get(clientId) || []);
    });
  }

  /**
   * Load a single client by ID (batched)
   */
  async loadClient(clientId: string): Promise<any | null> {
    return this.clientLoader.load(clientId);
  }

  /**
   * Load multiple clients by IDs (batched)
   */
  async loadClients(clientIds: string[]): Promise<(any | null)[]> {
    return this.clientLoader.loadMany(clientIds);
  }

  /**
   * Load bookings for a user (batched)
   */
  async loadUserBookings(userId: string): Promise<any[]> {
    return this.userBookingsLoader.load(userId);
  }

  /**
   * Load bookings for multiple users (batched)
   */
  async loadUsersBookings(userIds: string[]): Promise<any[][]> {
    const results = await this.userBookingsLoader.loadMany(userIds);
    return results.map((result) => (result instanceof Error ? [] : result));
  }

  /**
   * Load itineraries for a client (batched)
   */
  async loadClientItineraries(clientId: string): Promise<any[]> {
    return this.clientItinerariesLoader.load(clientId);
  }

  /**
   * Load itineraries for multiple clients (batched)
   */
  async loadClientsItineraries(clientIds: string[]): Promise<any[][]> {
    const results = await this.clientItinerariesLoader.loadMany(clientIds);
    return results.map((result) => (result instanceof Error ? [] : result));
  }

  /**
   * Clear all cached data (useful for testing or when data changes)
   */
  clearCache(): void {
    this.clientLoader.clearAll();
    this.userBookingsLoader.clearAll();
    this.clientItinerariesLoader.clearAll();
  }

  /**
   * Prime the cache with known data (optimization for frequently accessed data)
   */
  primeClient(clientId: string, clientData: any): void {
    this.clientLoader.prime(clientId, clientData);
  }

  primeUserBookings(userId: string, bookings: any[]): void {
    this.userBookingsLoader.prime(userId, bookings);
  }
}
