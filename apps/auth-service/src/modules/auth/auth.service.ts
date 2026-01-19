import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

/**
 * Servicio de autenticación.
 * Implementa la lógica de negocio para login, registro y validación.
 */
@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Prueba la conexión a Supabase.
   * Útil para verificar que las credenciales están configuradas correctamente.
   */
  async testSupabaseConnection() {
    try {
      const client = this.supabaseService.getClient();

      // Intenta obtener la sesión actual (si existe)
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
}
