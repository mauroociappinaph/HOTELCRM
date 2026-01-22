import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthProviderPort } from '../../domain/ports/auth-provider.port';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';

@Injectable()
export class SupabaseAuthProviderAdapter implements AuthProviderPort {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getGoogleLoginUrl(redirectTo?: string): Promise<{ url: string; provider: string }> {
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
  }

  async getCurrentUser(token?: string): Promise<{ id: string; email?: string }> {
    const client = this.supabaseService.getClient();

    if (token) {
      const { data: user, error } = await client.auth.getUser(token);
      if (error) throw error;
      return { id: user.user.id, email: user.user.email };
    }

    const { data: session, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;

    if (!session.session?.user) {
      throw new UnauthorizedException('No active session');
    }

    return { id: session.session.user.id, email: session.session.user.email };
  }

  async signOut(): Promise<{ success: boolean; message: string }> {
    const client = this.supabaseService.getClient();
    const { error } = await client.auth.signOut();

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: 'Successfully signed out',
    };
  }

  async refreshSession(refreshToken: string): Promise<any> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw new UnauthorizedException(`Refresh failed: ${error.message}`);
    }

    return {
      success: true,
      session: {
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      },
      user: data.user,
    };
  }
}
