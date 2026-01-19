import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

/**
 * Servicio de autenticación con Supabase Auth.
 * Implementa Google OAuth, session management y user profiles.
 */
@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Prueba la conexión a Supabase.
   */
  async testSupabaseConnection() {
    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.auth.getSession();

      if (error) {
        return {
          connected: false,
          error: error.message,
        };
      }

      return {
        connected: true,
        message: 'Supabase connection successful',
        hasSession: !!data.session,
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Genera URL de login con Google OAuth.
   */
  async getGoogleLoginUrl(redirectTo?: string) {
    try {
      const client = this.supabaseService.getClient();

      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo || `${process.env.FRONTEND_URL}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw new UnauthorizedException(`OAuth error: ${error.message}`);
      }

      return {
        url: data.url,
        provider: 'google',
      };
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Failed to generate Google login URL'
      );
    }
  }

  /**
   * Valida y obtiene información del usuario actual.
   */
  async getCurrentUser(token?: string) {
    try {
      const client = this.supabaseService.getClient();

      // Si hay token, usarlo para validar
      if (token) {
        const { data: user, error } = await client.auth.getUser(token);
        if (error) throw error;
        return this.getUserProfile(user.user.id);
      }

      // Si no hay token, obtener sesión actual
      const { data: session, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;

      if (!session.session?.user) {
        throw new UnauthorizedException('No active session');
      }

      return this.getUserProfile(session.session.user.id);
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Failed to get current user'
      );
    }
  }

  /**
   * Obtiene el perfil completo del usuario con agencia.
   */
  private async getUserProfile(userId: string) {
    try {
      const client = this.supabaseService.getClient();

      // Obtener perfil de auth.users
      const { data: authUser, error: authError } = await client.auth.admin.getUserById(userId);
      if (authError) throw authError;

      // Obtener perfil extendido de la tabla profiles
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select(`
          *,
          agencies:agency_id (
            id,
            name,
            tax_id
          )
        `)
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw profileError;
      }

      return {
        id: authUser.user.id,
        email: authUser.user.email,
        emailConfirmed: authUser.user.email_confirmed_at ? true : false,
        createdAt: authUser.user.created_at,
        lastSignIn: authUser.user.last_sign_in_at,
        profile: profile || null,
        agency: profile?.agencies || null,
      };
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Failed to get user profile'
      );
    }
  }

  /**
   * Cierra la sesión del usuario.
   */
  async signOut(token?: string) {
    try {
      const client = this.supabaseService.getClient();

      const { error } = await client.auth.signOut();

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'Successfully signed out',
      };
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Failed to sign out'
      );
    }
  }

  /**
   * Actualiza el perfil del usuario.
   */
  async updateProfile(userId: string, updates: {
    fullName?: string;
    agencyId?: string;
    role?: 'admin' | 'agent' | 'manager';
  }) {
    try {
      const client = this.supabaseService.getClient();

      // Verificar que el usuario existe
      const { data: existingProfile } = await client
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      const profileData = {
        id: userId,
        full_name: updates.fullName,
        agency_id: updates.agencyId,
        role: updates.role,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (existingProfile) {
        // Update existing profile
        const { data, error } = await client
          .from('profiles')
          .update(profileData)
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new profile
        const { data, error } = await client
          .from('profiles')
          .insert(profileData)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return {
        success: true,
        profile: result,
      };
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Failed to update profile'
      );
    }
  }

  /**
   * Lista usuarios de una agencia (solo para admins).
   */
  async listAgencyUsers(agencyId: string, requestingUserId: string) {
    try {
      const client = this.supabaseService.getClient();

      // Verificar que el usuario solicitante es admin de la agencia
      const { data: requesterProfile, error: profileError } = await client
        .from('profiles')
        .select('role, agency_id')
        .eq('id', requestingUserId)
        .single();

      if (profileError) throw profileError;

      if (requesterProfile.role !== 'admin' || requesterProfile.agency_id !== agencyId) {
        throw new UnauthorizedException('Insufficient permissions');
      }

      // Obtener todos los usuarios de la agencia
      const { data: users, error: usersError } = await client
        .from('profiles')
        .select(`
          id,
          full_name,
          role,
          created_at,
          agencies:agency_id (
            name,
            tax_id
          )
        `)
        .eq('agency_id', agencyId);

      if (usersError) throw usersError;

      return {
        success: true,
        users: users || [],
      };
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Failed to list agency users'
      );
    }
  }
}
