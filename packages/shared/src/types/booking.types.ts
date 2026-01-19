/**
 * Estados posibles de una reserva.
 */
export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

/**
 * Interfaz de reserva/booking.
 * Representa una reserva de viaje realizada por un cliente.
 */
export interface Booking {
  id: string;
  clientId: string;
  agencyId: string;
  itineraryId: string;
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}
