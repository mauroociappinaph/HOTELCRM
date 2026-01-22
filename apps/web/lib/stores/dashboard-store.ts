import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { DashboardDataDto, DashboardStatsDto, RecentActivityDto } from '@hotel-crm/shared';

interface DashboardState {
  // Estado
  stats: DashboardStatsDto | null;
  recentActivity: RecentActivityDto[];
  loading: boolean;
  error: string | null;

  // Acciones
  setStats: (stats: DashboardStatsDto | null) => void;
  setRecentActivity: (activity: RecentActivityDto[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Acciones asíncronas
  fetchDashboardData: () => Promise<void>;
  refreshStats: () => Promise<void>;
  clearError: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  devtools(
    (set) => ({
      // Estado inicial
      stats: null,
      recentActivity: [],
      loading: false,
      error: null,

      // Setters básicos
      setStats: (stats) => set({ stats }),
      setRecentActivity: (activity) => set({ recentActivity: activity }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // Limpiar error
      clearError: () => set({ error: null }),

      // Fetch dashboard data
      fetchDashboardData: async () => {
        try {
          set({ loading: true, error: null });

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/dashboard/stats`,
            {
              headers: {
                Authorization: `Bearer ${(await import('./auth-store')).useAuthStore.getState().session?.access_token}`,
              },
            },
          );

          if (!response.ok) {
            throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
          }

          const data: DashboardDataDto = await response.json();

          set({
            stats: data.stats,
            recentActivity: data.recentActivity,
            loading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          set({
            error: errorMessage,
            loading: false,
            stats: null,
            recentActivity: [],
          });
        }
      },

      // Refresh solo las estadísticas
      refreshStats: async () => {
        try {
          set({ loading: true, error: null });

          const response = await fetch(
            `${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/dashboard/stats`,
            {
              headers: {
                Authorization: `Bearer ${(await import('./auth-store')).useAuthStore.getState().session?.access_token}`,
              },
            },
          );

          if (!response.ok) {
            throw new Error(`Failed to refresh stats: ${response.statusText}`);
          }

          const data: DashboardDataDto = await response.json();

          set({
            stats: data.stats,
            loading: false,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to refresh stats';
          set({
            error: errorMessage,
            loading: false,
          });
        }
      },
    }),
    {
      name: 'dashboard-store',
    },
  ),
);
