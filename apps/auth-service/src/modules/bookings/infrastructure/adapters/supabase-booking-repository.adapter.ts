import { Injectable, NotFoundException } from '@nestjs/common';
import { Booking, BookingStatus } from '@hotel-crm/shared';
import { BookingRepositoryPort } from '../../domain/ports/booking-repository.port';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';

@Injectable()
export class SupabaseBookingRepositoryAdapter implements BookingRepositoryPort {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findById(id: string): Promise<Booking | null> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.mapToDomain(data) : null;
  }

  async findByAgency(
    agencyId: string,
    filters?: { status?: BookingStatus; clientId?: string },
  ): Promise<Booking[]> {
    const client = this.supabaseService.getClient();
    let query = client.from('bookings').select('*').eq('agency_id', agencyId);

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.clientId) query = query.eq('client_id', filters.clientId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((b) => this.mapToDomain(b));
  }

  async create(booking: Partial<Booking>): Promise<Booking> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('bookings')
      .insert({
        client_id: booking.clientId,
        agency_id: booking.agencyId,
        itinerary_id: booking.itineraryId,
        status: booking.status || BookingStatus.PENDING,
        total_amount: booking.totalAmount,
        currency: booking.currency || 'USD',
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapToDomain(data);
  }

  async update(id: string, updates: Partial<Booking>): Promise<Booking> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('bookings')
      .update({
        status: updates.status,
        total_amount: updates.totalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return this.mapToDomain(data);
  }

  async delete(id: string): Promise<boolean> {
    const client = this.supabaseService.getClient();
    const { error } = await client.from('bookings').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  /**
   * Mapea el registro de Supabase al objeto de Dominio.
   */
  private mapToDomain(dbRecord: any): Booking {
    return {
      id: dbRecord.id,
      clientId: dbRecord.client_id,
      agencyId: dbRecord.agency_id,
      itineraryId: dbRecord.itinerary_id,
      status: dbRecord.status as BookingStatus,
      totalAmount: dbRecord.total_amount,
      currency: dbRecord.currency,
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at),
    };
  }
}
