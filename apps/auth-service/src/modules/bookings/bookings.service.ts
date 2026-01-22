import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Booking, BookingStatus } from '@hotel-crm/shared';

import { BookingRepositoryPort } from './domain/ports/booking-repository.port';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(private readonly bookingRepository: BookingRepositoryPort) {}

  async create(createBookingDto: Partial<Booking>) {
    this.logger.log(`Creating booking for client ${createBookingDto.clientId}`);
    return this.bookingRepository.create(createBookingDto);
  }

  async findAll(agencyId: string, filters?: { status?: BookingStatus; clientId?: string }) {
    this.logger.log(`Listing bookings for agency ${agencyId}`);
    return this.bookingRepository.findByAgency(agencyId, filters);
  }

  async findOne(id: string) {
    const booking = await this.bookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }
    return booking;
  }

  async update(id: string, updateBookingDto: Partial<Booking>) {
    this.logger.log(`Updating booking ${id}`);
    await this.findOne(id); // Ensure exists
    return this.bookingRepository.update(id, updateBookingDto);
  }

  async remove(id: string) {
    this.logger.log(`Deleting booking ${id}`);
    await this.findOne(id); // Ensure exists
    return this.bookingRepository.delete(id);
  }
}
