import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthProviderPort } from './domain/ports/auth-provider.port';

/**
 * Guardián de autenticación basado en el puerto de identidad.
 * Valida el token JWT a través del adaptador configurado.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly authProvider: AuthProviderPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Validar el token a través del puerto
      const user = await this.authProvider.getCurrentUser(token);

      if (!user) {
        return false;
      }

      // Adjuntar el usuario al objeto request
      request.user = user;
      return true;
    } catch (error) {
      return false;
    }
  }
}