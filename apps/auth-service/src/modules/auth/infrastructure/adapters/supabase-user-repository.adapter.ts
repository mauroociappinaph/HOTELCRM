import { Injectable, UnauthorizedException } from '@nestjs/common';

import { UserRepositoryPort, UserProfile } from '../../domain/ports/user-repository.port';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';

@Injectable()
export class SupabaseUserRepositoryAdapter implements UserRepositoryPort {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const client = this.supabaseService.getClient();

    // Obtener perfil de auth.users (usando admin para ver detalles si es necesario)
    const { data: authUser, error: authError } = await client.auth.admin.getUserById(userId);
    if (authError) throw authError;

    // Obtener perfil extendido de la tabla profiles
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select(
        `
        *,
        agencies:agency_id (
          id,
          name,
          tax_id
        )
      `,
      )
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    return {
      id: authUser.user.id,
      email: authUser.user.email,
      emailConfirmed: !!authUser.user.email_confirmed_at,
      createdAt: new Date(authUser.user.created_at),
      lastSignIn: authUser.user.last_sign_in_at,
      fullName: profile?.full_name,
      agencyId: profile?.agency_id,
      role: profile?.role,
      agency: profile?.agencies || null,
    };
  }

  async updateProfile(
    userId: string,
    updates: { fullName?: string; agencyId?: string; role?: string },
  ): Promise<{ success: boolean; profile: any }> {
    const client = this.supabaseService.getClient();

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
      const { data, error } = await client
        .from('profiles')
        .update(profileData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await client.from('profiles').insert(profileData).select().single();

      if (error) throw error;
      result = data;
    }

    return {
      success: true,
      profile: result,
    };
  }

  async listAgencyUsers(agencyId: string): Promise<{ success: boolean; users: any[] }> {
    const client = this.supabaseService.getClient();

    const { data: users, error: usersError } = await client
      .from('profiles')
      .select(
        `
        id,
        full_name,
        role,
        created_at,
        agencies:agency_id (
          name,
          tax_id
        )
      `,
      )
      .eq('agency_id', agencyId);

    if (usersError) throw usersError;

    return {
      success: true,
      users: users || [],
    };
  }
}
