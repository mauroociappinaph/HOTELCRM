import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiModule } from './modules/ai/ai.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HealthModule } from './modules/health/health.module';
import { SecurityModule } from './modules/security/security.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { EtlModule } from './modules/etl/etl.module';
import { DataQualityModule } from './modules/data-quality/data-quality.module';
import { ContextManagerModule } from './modules/context-manager/context-manager.module';
import { BookingsModule } from './modules/bookings/bookings.module';

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
    DashboardModule,
    AiModule,
    PaymentsModule,
    HealthModule,
    SecurityModule,
    MonitoringModule,
    EtlModule,
    DataQualityModule,
    ContextManagerModule,
    BookingsModule,
  ],
})
export class AppModule {}
