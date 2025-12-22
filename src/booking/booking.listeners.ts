import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PaymentService } from '../payment/payment.service';
import { PrismaService } from '../auth/prisma.service';
import type { BookingCreatedEvent } from '../shared/events/booking.events';

@Injectable()
export class BookingListeners{
  constructor(
    private paymentService: PaymentService,
    private prisma: PrismaService,
  ) {}

  @OnEvent('booking.created')
  async handleBookingCreated(event: BookingCreatedEvent) {
    console.log('Booking created event received:', event);
    
    // Fetch resource to get pricing
    const resource = await this.prisma.resource.findUnique({
      where: { id: event.resourceId },
    });

    if (!resource) {
      console.error(`Resource ${event.resourceId} not found for booking ${event.bookingId}`);
      return;
    }

    // Calculate amount based on booking duration and resource price
    const durationInHours = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60);
    const amount = durationInHours * resource.price;
    
    // Trigger payment processing
    await this.paymentService.processPayment(
      event.bookingId,
      amount,
      event.paymentMethodId
    );
  }
}
