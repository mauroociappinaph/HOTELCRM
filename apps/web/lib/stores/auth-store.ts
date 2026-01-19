import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { User, Session } from '@supabase/supabase-js'
import { UserProfile } from '../supabase'

interface Agency {
  id: string
  name: string
  fiscal_config?: any
}

interface AuthState {
  // Estado
  user: User | null
  session: Session | null
  profile: UserProfile | null
  agency: Agency | null
  loading: boolean

  // Acciones
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setAgency: (agency: Agency | null) => void
  setLoading: (loading: boolean) => void

  // Acciones compuestas
  login: (user: User, session: Session, profile?: UserProfile, agency?: Agency) => void
  logout: () => void
  updateProfile: (profile: Partial<UserProfile>) => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      // Estado inicial
      user: null,
      session: null,
      profile: null,
      agency: null,
      loading: true,

      // Setters básicos
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setAgency: (agency) => set({ agency }),
      setLoading: (loading) => set({ loading }),

      // Acciones compuestas
      login: (user, session, profile, agency) => {
        set({
          user,
          session,
          profile: profile || null,
          agency: agency || null,
          loading: false,
        })
      },

      logout: () => {
        set({
          user: null,
          session: null,
          profile: null,
          agency: null,
          loading: false,
        })
      },

      updateProfile: (updates) => {
        const currentProfile = get().profile
        if (currentProfile) {
          set({
            profile: { ...currentProfile, ...updates }
          })
        }
      },
    }),
    {
      name: 'auth-store',
    }
  )
)
