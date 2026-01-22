import { Module } from '@nestjs/common';

import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingRepositoryPort } from './domain/ports/booking-repository.port';
import { SupabaseBookingRepositoryAdapter } from './infrastructure/adapters/supabase-booking-repository.adapter';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    {
      provide: BookingRepositoryPort,
      useClass: SupabaseBookingRepositoryAdapter,
    },
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
