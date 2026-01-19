/**
 * DTO for dashboard statistics
 */
export class DashboardStatsDto {
  totalBookings: number
  totalClients: number
  totalRevenue: number
  pendingPayments: number
  upcomingBookings: number
  averageBookingValue: number

  constructor(data?: Partial<DashboardStatsDto>) {
    this.totalBookings = data?.totalBookings ?? 0
    this.totalClients = data?.totalClients ?? 0
    this.totalRevenue = data?.totalRevenue ?? 0
    this.pendingPayments = data?.pendingPayments ?? 0
    this.upcomingBookings = data?.upcomingBookings ?? 0
    this.averageBookingValue = data?.averageBookingValue ?? 0
  }
}

/**
 * DTO for recent activity items
 */
export class RecentActivityDto {
  id: string
  type: 'booking' | 'payment' | 'client' | 'message'
  title: string
  description: string
  timestamp: string
  status?: 'success' | 'warning' | 'error'

  constructor(data?: Partial<RecentActivityDto>) {
    this.id = data?.id ?? ''
    this.type = data?.type ?? 'booking'
    this.title = data?.title ?? ''
    this.description = data?.description ?? ''
    this.timestamp = data?.timestamp ?? new Date().toISOString()
    this.status = data?.status ?? 'success'
  }
}

/**
 * Complete dashboard data response
 */
export class DashboardDataDto {
  stats: DashboardStatsDto
  recentActivity: RecentActivityDto[]
  alerts: string[]

  constructor(data?: Partial<DashboardDataDto>) {
    this.stats = data?.stats ?? new DashboardStatsDto()
    this.recentActivity = data?.recentActivity ?? []
    this.alerts = data?.alerts ?? []
  }
}
