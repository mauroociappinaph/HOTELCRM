import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';

/**
 * Módulo raíz del microservicio de autenticación.
 * Configura las variables de entorno y los módulos principales.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    AuthModule,
  ],
})
export class AppModule {}
