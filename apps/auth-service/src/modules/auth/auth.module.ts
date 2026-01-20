import { Module } from '@nestjs/common';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Módulo de autenticación.
 * Gestiona login, registro y validación de tokens.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, SupabaseService],
  exports: [AuthService],
})
export class AuthModule {}
