/**
 * Authentication and Authorization Types
 * Focuses on identity and multitenancy across the system
 */

/**
 * Represents the authenticated user identity as extracted from JWT
 */
export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  metadata: {
    agencyId?: string;
    fullName?: string;
    [key: string]: unknown;
  };
}

/**
 * Common roles for RBAC
 */
export enum AppRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  AGENT = 'agent',
}
