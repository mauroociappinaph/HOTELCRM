import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { AuthProviderPort } from './domain/ports/auth-provider.port';
import { UserRepositoryPort } from './domain/ports/user-repository.port';

/**
 * Servicio de autenticación (Dominio).
 * Orquesta las operaciones de identidad y perfiles de usuario a través de puertos.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authProvider: AuthProviderPort,
    private readonly userRepository: UserRepositoryPort,
  ) {}

  /**
   * Prueba la conexión al proveedor de autenticación.
   */
  async testSupabaseConnection() {
    try {
      const user = await this.authProvider.getCurrentUser().catch(() => null);
      
      return {
        connected: true,
        message: 'Auth provider connection active',
        hasSession: !!user,
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
    return this.authProvider.getGoogleLoginUrl(redirectTo);
  }

  /**
   * Valida y obtiene información del usuario actual con su perfil completo.
   */
  async getCurrentUser(token?: string) {
    try {
      const authUser = await this.authProvider.getCurrentUser(token);
      return this.userRepository.getUserProfile(authUser.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting current user: ${message}`);
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Failed to get current user',
      );
    }
  }

  /**
   * Cierra la sesión del usuario.
   */
  async signOut() {
    return this.authProvider.signOut();
  }

  /**
   * Actualiza el perfil del usuario.
   */
  async updateProfile(
    userId: string,
    updates: {
      fullName?: string;
      agencyId?: string;
      role?: string;
    },
  ) {
    try {
      return this.userRepository.updateProfile(userId, updates);
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Failed to update profile',
      );
    }
  }

  /**
   * Lista usuarios de una agencia (solo para admins).
   */
  async listAgencyUsers(agencyId: string, requestingUserId: string) {
    try {
      const requester = await this.userRepository.getUserProfile(requestingUserId);

      if (!requester || requester.role !== 'admin' || requester.agencyId !== agencyId) {
        throw new UnauthorizedException('Insufficient permissions');
      }

      return this.userRepository.listAgencyUsers(agencyId);
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Failed to list agency users',
      );
    }
  }

  /**
   * Refresca la sesión activa del usuario.
   */
  async refreshSession(refreshToken: string) {
    return this.authProvider.refreshSession(refreshToken);
  }
}