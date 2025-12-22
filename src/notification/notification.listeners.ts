import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from './notification.service';
import type { 
  BookingCreatedEvent, 
  BookingConfirmedEvent, 
  BookingCanceledEvent 
} from '../shared/events/booking.events';

@Injectable()
export class NotificationListeners {
  constructor(private notificationService: NotificationService) {}

  @OnEvent('booking.created')
  async handleBookingCreated(event: BookingCreatedEvent) {
    console.log('Notification: Booking created event received:', event);
    await this.notificationService.handleBookingCreated(event);
  }

  @OnEvent('booking.confirmed')
  async handleBookingConfirmed(event: BookingConfirmedEvent) {
    console.log('Notification: Booking confirmed event received:', event);
    await this.notificationService.handleBookingConfirmed(event);
  }

  @OnEvent('booking.canceled')
  async handleBookingCanceled(event: BookingCanceledEvent) {
    console.log('Notification: Booking canceled event received:', event);
    await this.notificationService.handleBookingCanceled(event);
  }
}
