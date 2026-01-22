import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { HealthService } from './health.service';

/**
 * 🏥 Health Dashboard para el servicio Auth & Operations.
 * Proporciona endpoints para monitoreo de infraestructura y servicios externos.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private customHealth: HealthService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Chequeo de salud integral del servicio' })
  check() {
    return this.health.check([
      // Memoria: Máximo 300MB de Heap (ajustar según entorno)
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      // Disco: Umbral de uso
      () => this.disk.checkStorage('disk_storage', { path: '/', thresholdPercent: 0.9 }),
      // Supabase: Conexión activa
      () => this.customHealth.checkSupabaseConnection('supabase'),
    ]);
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe básica' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}