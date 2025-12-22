import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { PaymentService } from '../payment/payment.service';
import { CreateBookingDto } from '../shared/dto/create-booking.dto';
import { buildPaginationMeta, type PaginationParams } from '../shared/pagination';
import type { 
  BookingCreatedEvent, 
  BookingConfirmedEvent, 
  BookingCanceledEvent 
} from '../shared/events/booking.events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CustomLoggerService } from '../shared/logger/logger.service';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
    private paymentService: PaymentService,
    private eventEmitter: EventEmitter2,
    private logger: CustomLoggerService,
  ) {
    this.logger.setContext('BookingService');
  }

  async create(userId: number, createBookingDto: CreateBookingDto) {
    const { resourceId, startTime, endTime, paymentMethodId } = createBookingDto;

    this.logger.log(`Creating booking for user ${userId}, resource ${resourceId}`);
    this.logger.debug(`Booking details: ${JSON.stringify({ startTime, endTime, paymentMethodId: paymentMethodId ? 'provided' : 'not provided' })}`);

    // Check availability first
    const availability = await this.availabilityService.checkAvailability(
      resourceId,
      new Date(startTime),
      new Date(endTime),
    );

    if (!availability.available) {
      this.logger.warn(`Booking creation failed: Resource ${resourceId} not available for requested time slot`);
      throw new BadRequestException('Resource is not available for the requested time slot');
    }

    // Fetch resource to get pricing
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      this.logger.error(`Booking creation failed: Resource ${resourceId} not found`);
      throw new NotFoundException('Resource not found');
    }

    // Calculate payment amount using resource price
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const amount = durationInHours * resource.price;

    this.logger.log(`Calculated booking amount: $${amount} (${durationInHours} hours @ $${resource.price}/hour)`);

    // If no payment method provided, return payment intent for client confirmation
    if (!paymentMethodId) {
      this.logger.warn(`Booking creation paused: Payment method not provided for user ${userId}`);
      // Create a temporary booking record or return payment details
      return {
        requiresPayment: true,
        amount,
        message: 'Please provide payment method to complete booking',
        bookingDetails: {
          userId,
          resourceId,
          startTime,
          endTime,
        },
      };
    }

    // Process payment FIRST before creating booking
    this.logger.log(`Processing payment for booking: User ${userId}, Amount $${amount}`);
    let paymentResult;
    try {
      // Create temporary booking data for payment metadata
      const tempBookingData = {
        userId,
        resourceId,
        startTime: start,
        endTime: end,
      };

      paymentResult = await this.paymentService.processPaymentForBooking(
        tempBookingData,
        amount,
        paymentMethodId,
      );

      if (!paymentResult.success) {
        this.logger.error(`Payment failed for user ${userId}: ${paymentResult.error || 'Unknown error'}`);
        throw new BadRequestException(
          `Payment failed: ${paymentResult.error || 'Unknown error'}`,
        );
      }
    } catch (error) {
      this.logger.error(`Payment processing failed for user ${userId}: ${error.message}`, error.stack);
      throw new BadRequestException(
        `Payment processing failed: ${error.message}`,
      );
    }

    this.logger.log(`Payment successful: ${paymentResult.paymentId}`);

    // Only create booking AFTER successful payment
    this.logger.log(`Creating booking record for user ${userId}`);
    const booking = await this.prisma.booking.create({
      data: {
        userId,
        resourceId,
        startTime: start,
        endTime: end,
        status: 'CONFIRMED', // Set to CONFIRMED since payment succeeded
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        resource: true,
      },
    });

    const paymentMethod = paymentMethodId
      ? await this.paymentService.syncPaymentMethod(booking.userId, paymentMethodId)
      : null;

    // Create Payment record in database
    const payment = await (this.prisma.payment as any).create({
      data: {
        stripePaymentId: paymentResult.paymentId,
        bookingId: booking.id,
        amount: paymentResult.amount,
        currency: 'usd',
        status: paymentResult.status,
        paymentMethod: paymentMethodId,
        paymentMethodId: paymentMethod?.id,
        description: `Booking #${booking.id} - ${booking.resource.title}`,
        metadata: {
          userId: booking.userId.toString(),
          resourceId: booking.resourceId.toString(),
        },
      },
    });

    // Emit booking confirmed event (skip booking.created since we go straight to confirmed)
    const bookingConfirmedEvent: BookingConfirmedEvent = {
      bookingId: booking.id,
      userId: booking.userId,
      resourceId: booking.resourceId,
      paymentId: paymentResult.paymentId,
    };

    this.eventEmitter.emit('booking.confirmed', bookingConfirmedEvent);
    this.logger.log(`Booking created successfully: ID ${booking.id}, User ${userId}, Resource ${resourceId}`);

    return {
      ...booking,
      payment: {
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
      },
    };
  }

  async findAll(pagination?: PaginationParams) {
    const effectivePagination = pagination ?? { page: 1, limit: 100, skip: 0 };

    const where = effectivePagination.search
      ? {
          OR: [
            { resource: { title: { contains: effectivePagination.search, mode: 'insensitive' as const } } },
            { resource: { code: { contains: effectivePagination.search, mode: 'insensitive' as const } } },
            { user: { email: { contains: effectivePagination.search, mode: 'insensitive' as const } } },
          ],
        }
      : undefined;

    const [total, data] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        skip: effectivePagination.skip,
        take: effectivePagination.limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          resource: true,
          payment: {
            select: {
              amount: true,
              paymentMethod: true,
              status: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      data,
      meta: buildPaginationMeta({
        total,
        page: effectivePagination.page,
        limit: effectivePagination.limit,
      }),
    };
  }

  async findByUser(userId: number) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: {
        resource: true,
        payment: {
          select: {
            amount: true,
            paymentMethod: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByResource(resourceId: number) {
    return this.prisma.booking.findMany({
      where: { resourceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        payment: {
          select: {
            amount: true,
            paymentMethod: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number) {
    this.logger.debug(`Fetching booking with ID: ${id}`);
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        resource: true,
        payment: {
          select: {
            amount: true,
            paymentMethod: true,
            status: true,
          },
        },
      },
    });

    if (!booking) {
      this.logger.warn(`Booking not found: ID ${id}`);
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  async updateStatus(id: number, status: 'PENDING' | 'CONFIRMED' | 'CANCELED') {
    this.logger.log(`Updating booking ${id} status to: ${status}`);
    const booking = await this.prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        resource: true,
        payment: {
          select: {
            amount: true,
            paymentMethod: true,
            status: true,
          },
        },
      },
    });

    // Emit appropriate events
    if (status === 'CONFIRMED') {
      const bookingConfirmedEvent: BookingConfirmedEvent = {
        bookingId: booking.id,
        userId: booking.userId,
        resourceId: booking.resourceId,
      };
      this.eventEmitter.emit('booking.confirmed', bookingConfirmedEvent);
      this.logger.log(`Booking ${id} confirmed event emitted`);
    } else if (status === 'CANCELED') {
      const bookingCanceledEvent: BookingCanceledEvent = {
        bookingId: booking.id,
        userId: booking.userId,
        resourceId: booking.resourceId,
      };
      this.eventEmitter.emit('booking.canceled', bookingCanceledEvent);
      this.logger.log(`Booking ${id} canceled event emitted`);
    }

    return booking;
  }

  async cancel(id: number, reason?: string) {
    this.logger.log(`Canceling booking ${id}${reason ? ` - Reason: ${reason}` : ''}`);
    return this.updateStatus(id, 'CANCELED');
  }

  async confirm(id: number) {
    return this.updateStatus(id, 'CONFIRMED');
  }
}
