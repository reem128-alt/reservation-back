import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [AvailabilityModule, PaymentModule],
  providers: [BookingService],
  controllers: [BookingController],
  exports: [BookingService],
})
export class BookingModule {}
