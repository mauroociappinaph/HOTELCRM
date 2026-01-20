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
   * Get real dashboard statistics from database with optimized queries
   * Uses single query approach to avoid N+1 problems
   */
  private async getRealDashboardStats(agencyId: string): Promise<DashboardStatsDto> {
    const client = this.supabaseService.getClient();

    // Optimized: Single query to get all booking statistics
    const { data: bookingStats, error: bookingError } = await client
      .from('bookings')
      .select(`
        total_amount,
        payment_status,
        start_date,
        agency_id
      `)
      .eq('agency_id', agencyId);

    if (bookingError) {
      this.logger.error('Error fetching booking stats:', bookingError);
      throw bookingError;
    }

    // Calculate statistics from booking data
    const bookings = bookingStats || [];
    const totalBookings = bookings.length;
    const totalRevenue = bookings
      .filter(b => b.payment_status === 'paid')
      .reduce((sum, b) => sum + (b.total_amount || 0), 0);
    const pendingPayments = bookings.filter(b => b.payment_status === 'pending').length;

    // Upcoming bookings (next 30 days) - optimized with date filtering
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const upcomingBookings = bookings.filter(b => {
      if (!b.start_date) return false;
      const startDate = new Date(b.start_date);
      return startDate >= new Date() && startDate <= thirtyDaysFromNow;
    }).length;

    // Total clients - single optimized query
    const { count: totalClients, error: clientError } = await client
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('agency_id', agencyId);

    if (clientError) {
      this.logger.error('Error fetching client count:', clientError);
      throw clientError;
    }

    // Calculate average booking value
    const averageBookingValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

    return new DashboardStatsDto({
      totalBookings,
      totalClients: totalClients ?? 0,
      totalRevenue,
      pendingPayments,
      upcomingBookings,
      averageBookingValue,
    });
  }
}
