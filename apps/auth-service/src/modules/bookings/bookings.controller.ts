import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BookingStatus } from '@hotel-crm/shared';

import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

import { BookingsService } from './bookings.service';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva reserva' })
  @ApiResponse({ status: 201, description: 'Reserva creada exitosamente' })
  create(@Body() createBookingDto: any) {
    return this.bookingsService.create(createBookingDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las reservas de la agencia' })
  @ApiQuery({ name: 'status', enum: BookingStatus, required: false })
  @ApiQuery({ name: 'clientId', required: false })
  findAll(
    @Query('agencyId') agencyId: string, // En producción se obtendría del JWT
    @Query('status') status?: BookingStatus,
    @Query('clientId') clientId?: string,
  ) {
    return this.bookingsService.findAll(agencyId, { status, clientId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una reserva' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una reserva' })
  update(@Param('id') id: string, @Body() updateBookingDto: any) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una reserva' })
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
