import { Request } from 'express';
import { User } from '@supabase/supabase-js';

/**
 * Extended Request interface for NestJS Controllers to provide type-safe access
 * to user information injected by SupabaseAuthGuard.
 */
export interface AuthenticatedRequest extends Request {
  user: User;
}
