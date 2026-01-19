import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { DashboardDataDto, DashboardStatsDto, RecentActivityDto } from '@hotel-crm/shared';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Get dashboard statistics for the current user's agency
   */
  async getDashboardStats(userId: string): Promise<DashboardDataDto> {
    try {
      const client = this.supabaseService.getClient();

      // Get user profile to determine agency
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('agency_id, role')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        throw new Error('User profile not found');
      }

      const agencyId = profile.agency_id;

      // For demo purposes, return mock data
      // In production, these would be real database queries
      const stats = new DashboardStatsDto({
        totalBookings: 45,
        totalClients: 23,
        totalRevenue: 125000,
        pendingPayments: 3,
        upcomingBookings: 8,
        averageBookingValue: 2778,
      });

      const recentActivity = [
        new RecentActivityDto({
          id: '1',
          type: 'booking',
          title: 'Nueva reserva confirmada',
          description: 'Juan Pérez - Viaje a Bariloche',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'success',
        }),
        new RecentActivityDto({
          id: '2',
          type: 'message',
          title: 'Mensaje de cliente',
          description: 'Consulta sobre itinerario a Mendoza',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          status: 'success',
        }),
        new RecentActivityDto({
          id: '3',
          type: 'payment',
          title: 'Pago pendiente',
          description: 'Reserva #1234 - $25,000',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          status: 'warning',
        }),
      ];

      return new DashboardDataDto({
        stats,
        recentActivity,
        alerts: [],
      });

    } catch (error) {
      this.logger.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get real dashboard statistics from database
   * This would be used in production with actual queries
   */
  private async getRealDashboardStats(agencyId: string): Promise<DashboardStatsDto> {
    const client = this.supabaseService.getClient();

    // Example queries (would be uncommented in production)
    /*
    // Total bookings
    const { count: totalBookings } = await client
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId);

    // Total clients
    const { count: totalClients } = await client
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId);

    // Total revenue
    const { data: revenueData } = await client
      .from('bookings')
      .select('total_amount')
      .eq('agency_id', agencyId)
      .eq('payment_status', 'paid');

    const totalRevenue = revenueData?.reduce((sum, booking) => sum + booking.total_amount, 0) ?? 0;

    // Pending payments
    const { count: pendingPayments } = await client
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('payment_status', 'pending');

    // Upcoming bookings (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { count: upcomingBookings } = await client
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .gte('start_date', new Date().toISOString())
      .lte('start_date', thirtyDaysFromNow.toISOString());

    // Average booking value
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    return new DashboardStatsDto({
      totalBookings: totalBookings ?? 0,
      totalClients: totalClients ?? 0,
      totalRevenue,
      pendingPayments: pendingPayments ?? 0,
      upcomingBookings: upcomingBookings ?? 0,
      averageBookingValue: Math.round(averageBookingValue),
    });
    */

    // Return mock data for demo
    return new DashboardStatsDto({
      totalBookings: 45,
      totalClients: 23,
      totalRevenue: 125000,
      pendingPayments: 3,
      upcomingBookings: 8,
      averageBookingValue: 2778,
    });
  }
}
