import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Servicio de conexión a Supabase.
 * Gestiona la instancia única del cliente de Supabase para toda la aplicación.
 * Implementa el patrón Singleton para evitar múltiples conexiones.
 *
 * @example
 * ```typescript
 * const client = this.supabaseService.getClient();
 * const { data, error } = await client.from('users').select('*');
 * ```
 */
@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Supabase credentials are missing in environment variables. ' +
          'Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local',
      );
    }

    this.client = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized successfully');
  }

  /**
   * Obtiene la instancia del cliente de Supabase.
   * @returns Cliente de Supabase configurado
   */
  getClient(): SupabaseClient {
    return this.client;
  }
}
