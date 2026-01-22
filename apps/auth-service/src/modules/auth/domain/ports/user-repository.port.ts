import { User } from '@hotel-crm/shared';

/**
 * Representa el perfil extendido de un usuario con datos de agencia.
 */
export interface UserProfile extends Partial<User> {
  emailConfirmed?: boolean;
  lastSignIn?: string;
  agency?: {
    id: string;
    name: string;
    tax_id?: string;
  } | null;
}

/**
 * Puerto para el repositorio de usuarios.
 * Maneja la persistencia de perfiles y relaciones con agencias.
 */
export abstract class UserRepositoryPort {
  /**
   * Obtiene el perfil completo de un usuario.
   */
  abstract getUserProfile(userId: string): Promise<UserProfile | null>;

  /**
   * Crea o actualiza el perfil de un usuario.
   */
  abstract updateProfile(
    userId: string,
    updates: {
      fullName?: string;
      agencyId?: string;
      role?: string;
    },
  ): Promise<{ success: boolean; profile: any }>;

  /**
   * Lista los usuarios de una agencia.
   */
  abstract listAgencyUsers(agencyId: string): Promise<{ success: boolean; users: any[] }>;
}
