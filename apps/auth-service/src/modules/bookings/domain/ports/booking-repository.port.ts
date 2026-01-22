import { Booking, BookingStatus } from '@hotel-crm/shared';

/**
 * Puerto para el repositorio de reservas.
 * Define las operaciones de persistencia del dominio de bookings.
 */
export abstract class BookingRepositoryPort {
  /**
   * Obtiene una reserva por su ID.
   */
  abstract findById(id: string): Promise<Booking | null>;

  /**
   * Lista reservas de una agencia con filtros opcionales.
   */
  abstract findByAgency(
    agencyId: string,
    filters?: { status?: BookingStatus; clientId?: string },
  ): Promise<Booking[]>;

  /**
   * Crea una nueva reserva.
   */
  abstract create(booking: Partial<Booking>): Promise<Booking>;

  /**
   * Actualiza una reserva existente.
   */
  abstract update(id: string, updates: Partial<Booking>): Promise<Booking>;

  /**
   * Elimina una reserva.
   */
  abstract delete(id: string): Promise<boolean>;
}
