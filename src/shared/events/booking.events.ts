export interface BookingCreatedEvent {
  bookingId: number;
  userId: number;
  resourceId: number;
  startTime: Date;
  endTime: Date;
  status: string;
  paymentMethodId?: string;
}

export interface BookingConfirmedEvent {
  bookingId: number;
  userId: number;
  resourceId: number;
  paymentId?: string;
}

export interface BookingCanceledEvent {
  bookingId: number;
  userId: number;
  resourceId: number;
  reason?: string;
}
