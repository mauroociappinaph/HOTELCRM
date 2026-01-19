import { UserRole } from '../types/user.types';

/**
 * DTO para creación de usuario.
 * Utilizado en la comunicación entre microservicios.
 */
export interface CreateUserDto {
  email: string;
  role: UserRole;
  agencyId: string;
  fullName?: string;
}
