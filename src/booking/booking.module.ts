import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { PrismaService } from '../auth/prisma.service';
import { AvailabilityModule } from '../availability/availability.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [AvailabilityModule, PaymentModule],
  providers: [BookingService, PrismaService],
  controllers: [BookingController],
  exports: [BookingService],
})
export class BookingModule {}
