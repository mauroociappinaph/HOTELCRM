import { BookingStatus } from '../types/booking.types';

/**
 * DTO para creación de reserva.
 * Utilizado en la comunicación entre microservicios.
 */
export interface CreateBookingDto {
  clientId: string;
  itineraryId: string;
  totalAmount: number;
  currency: string;
  status?: BookingStatus;
}
