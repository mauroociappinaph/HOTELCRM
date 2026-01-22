import { AuthUser } from '@hotel-crm/shared';

/**
 * Puerto para el proveedor de autenticación.
 * Define las operaciones de identidad y sesión.
 */
export abstract class AuthProviderPort {
  /**
   * Obtiene la URL para iniciar sesión con Google.
   */
  abstract getGoogleLoginUrl(redirectTo?: string): Promise<{ url: string; provider: string }>;

  /**
   * Obtiene el usuario actual a partir de un token o sesión.
   */
  abstract getCurrentUser(token?: string): Promise<{ id: string; email?: string }>;

  /**
   * Cierra la sesión activa.
   */
  abstract signOut(): Promise<{ success: boolean; message: string }>;

  /**
   * Refresca la sesión activa.
   */
  abstract refreshSession(refreshToken: string): Promise<any>;
}
