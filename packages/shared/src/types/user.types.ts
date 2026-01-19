/**
 * Roles de usuario en el sistema CRM.
 * - ADMIN: Administrador con acceso total a la agencia
 * - AGENT: Agente de viajes con permisos de gestión de clientes
 * - MANAGER: Gerente con permisos de supervisión y reportes
 */
export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
  MANAGER = 'manager',
}

/**
 * Interfaz principal de usuario del sistema.
 * Representa un usuario autenticado vinculado a una agencia.
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  agencyId: string;
  fullName?: string;
  createdAt: Date;
  updatedAt: Date;
}
