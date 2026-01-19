import { Controller, Get, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Controlador de autenticación.
 * Expone endpoints para login y gestión de usuarios.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Health check del servicio de autenticación.
   */
  @Get('health')
  healthCheck() {
    return {
      service: 'auth-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Endpoint de prueba para verificar conexión a Supabase.
   */
  @Get('test-connection')
  async testConnection() {
    return this.authService.testSupabaseConnection();
  }
}
