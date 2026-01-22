// Modern Supabase client setup for Next.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client with proper configuration for Next.js
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Server-side Supabase client (for API routes)
export const createServerSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });
};

// Admin client for server-side operations
export const createAdminSupabaseClient = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Types for our user data
export interface UserProfile {
  id: string;
  email: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignIn: string;
  profile?: {
    full_name?: string;
    role: 'admin' | 'agent' | 'manager';
    agency_id?: string;
    updated_at: string;
  };
  agency?: {
    id: string;
    name: string;
    tax_id: string;
  };
}
