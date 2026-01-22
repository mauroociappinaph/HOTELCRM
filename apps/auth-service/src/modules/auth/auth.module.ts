import { Module } from '@nestjs/common';

import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

// Ports & Adapters
import { AuthProviderPort } from './domain/ports/auth-provider.port';
import { UserRepositoryPort } from './domain/ports/user-repository.port';
import { SupabaseAuthProviderAdapter } from './infrastructure/adapters/supabase-auth-provider.adapter';
import { SupabaseUserRepositoryAdapter } from './infrastructure/adapters/supabase-user-repository.adapter';

@Module({
  imports: [SupabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SupabaseAuthGuard,
    {
      provide: AuthProviderPort,
      useClass: SupabaseAuthProviderAdapter,
    },
    {
      provide: UserRepositoryPort,
      useClass: SupabaseUserRepositoryAdapter,
    },
  ],
  exports: [AuthService, SupabaseAuthGuard, AuthProviderPort, UserRepositoryPort],
})
export class AuthModule {}
