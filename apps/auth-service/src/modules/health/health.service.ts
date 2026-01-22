import { Injectable, Logger } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service';

/**
 * 🏥 Servicio de salud personalizado para HOTELCRM.
 * Verifica conexiones críticas con proveedores externos.
 */
@Injectable()
export class HealthService extends HealthIndicator {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly supabaseService: SupabaseService) {
    super();
  }

  /**
   * Verifica la conexión con Supabase.
   */
  async checkSupabaseConnection(key: string): Promise<HealthIndicatorResult> {
    try {
      const client = this.supabaseService.getClient();
      // Intentamos una operación mínima para validar la conexión
      const { error } = await client.from('profiles').select('id').limit(1);

      if (error) {
        throw new Error(error.message);
      }

      return this.getStatus(key, true);
    } catch (error) {
      this.logger.error(`Supabase health check failed: ${error.message}`);
      throw new HealthCheckError('Supabase check failed', this.getStatus(key, false, { message: error.message }));
    }
  }
}