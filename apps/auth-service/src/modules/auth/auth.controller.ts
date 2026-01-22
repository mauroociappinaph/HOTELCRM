import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Headers,
  UnauthorizedException,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { AuthService } from './auth.service';

/**
 * Controlador de autenticación con Supabase Auth.
 * Expone endpoints para Google OAuth, session management y user profiles.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Health check del servicio de autenticación.
   */
  @Get('health')
  @ApiOperation({ summary: 'Verificar estado del servicio de autenticación' })
  @ApiResponse({ status: 200, description: 'Servicio saludable' })
  healthCheck() {
    return {
      service: 'auth-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
    };
  }

  /**
   * Endpoint de prueba para verificar conexión a Supabase.
   */
  @Get('test-connection')
  @ApiOperation({ summary: 'Probar conexión con Supabase' })
  @ApiResponse({ status: 200, description: 'Conexión exitosa' })
  async testConnection() {
    return this.authService.testSupabaseConnection();
  }

  /**
   * Genera URL de login con Google OAuth.
   */
  @Get('google/login')
  @ApiOperation({ summary: 'Obtener URL de autenticación de Google' })
  @ApiQuery({ name: 'redirect_to', required: false, description: 'URL de redirección post-login' })
  async getGoogleLoginUrl(@Query('redirect_to') redirectTo?: string) {
    return this.authService.getGoogleLoginUrl(redirectTo);
  }

  /**
   * Obtiene información del usuario actual.
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil recuperado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getCurrentUser(@Headers('authorization') authHeader?: string) {
    // Extraer token del header Authorization: Bearer <token>
    const token = authHeader?.replace('Bearer ', '');
    return this.authService.getCurrentUser(token);
  }

  /**
   * Cierra la sesión del usuario.
   */
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión' })
  async signOut() {
    return this.authService.signOut();
  }

  /**
   * Actualiza el perfil del usuario.
   */
  @Put('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil del usuario' })
  async updateProfile(
    @Headers('authorization') authHeader: string,
    @Body()
    updates: {
      fullName?: string;
      agencyId?: string;
      role?: 'admin' | 'agent' | 'manager';
    },
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await this.authService.getCurrentUser(token);

    if (!user?.id) {
      throw new UnauthorizedException('User profile not found');
    }

    return this.authService.updateProfile(user.id, updates);
  }

  /**
   * Lista usuarios de una agencia (solo para admins).
   */
  @Get('agency/:agencyId/users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar usuarios de una agencia' })
  async listAgencyUsers(
    @Param('agencyId') agencyId: string,
    @Headers('authorization') authHeader: string,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await this.authService.getCurrentUser(token);

    if (!user?.id) {
      throw new UnauthorizedException('User profile not found');
    }

    return this.authService.listAgencyUsers(agencyId, user.id);
  }

  /**
   * Callback endpoint para OAuth (usado por frontend).
   */
  @Get('callback')
  @ApiOperation({ summary: 'Callback de OAuth' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      throw new UnauthorizedException(`OAuth error: ${error}`);
    }

    if (!code) {
      throw new UnauthorizedException('Authorization code required');
    }

    return {
      success: true,
      message: 'OAuth callback handled successfully',
      code: code,
      state: state,
      redirectTo: process.env.FRONTEND_URL || 'http://localhost:3000',
    };
  }

  /**
   * Refresh token endpoint.
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Refrescar sesión con refresh token' })
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.authService.refreshSession(body.refreshToken);
  }
}
