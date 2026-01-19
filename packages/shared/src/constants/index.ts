/**
 * Tasas impositivas para servicios turísticos en Argentina.
 * Según normativa ARCA/AFIP vigente.
 */
export const TAX_RATES = {
  /**
   * Impuesto PAIS: 30% para servicios en el exterior
   * Aplicable a compras con tarjeta en moneda extranjera
   */
  IMPUESTO_PAIS: 0.30,

  /**
   * Percepción de Ganancias: 45% para tarjetas de crédito
   * Adelanto de impuesto a las ganancias
   */
  PERCEPCION_GANANCIAS: 0.45,
} as const;

/**
 * Idiomas soportados por el sistema.
 * Español e Inglés para internacionalización.
 */
export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;

/**
 * Puertos de los microservicios en desarrollo.
 */
export const SERVICE_PORTS = {
  AUTH_SERVICE: 3001,
  IA_RAG_SERVICE: 3002,
  BOOKING_SERVICE: 3003,
  COMMUNICATION_SERVICE: 3004,
  FINANCE_SERVICE: 3005,
  NOTIFICATION_SERVICE: 3006,
  WEB_FRONTEND: 3000,
} as const;
