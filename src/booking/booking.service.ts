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

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private availabilityService: AvailabilityService,
    private paymentService: PaymentService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(userId: number, createBookingDto: CreateBookingDto) {
    const { resourceId, startTime, endTime, paymentMethodId } = createBookingDto;

    // Check availability first
    const availability = await this.availabilityService.checkAvailability(
      resourceId,
      new Date(startTime),
      new Date(endTime),
    );

    if (!availability.available) {
      throw new BadRequestException('Resource is not available for the requested time slot');
    }

    // Fetch resource to get pricing
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    // Calculate payment amount using resource price
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const amount = durationInHours * resource.price;

    // If no payment method provided, return payment intent for client confirmation
    if (!paymentMethodId) {
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
        throw new BadRequestException(
          `Payment failed: ${paymentResult.error || 'Unknown error'}`,
        );
      }
    } catch (error) {
      throw new BadRequestException(
        `Payment processing failed: ${error.message}`,
      );
    }

    // Only create booking AFTER successful payment
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
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return booking;
  }

  async updateStatus(id: number, status: 'PENDING' | 'CONFIRMED' | 'CANCELED') {
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
    } else if (status === 'CANCELED') {
      const bookingCanceledEvent: BookingCanceledEvent = {
        bookingId: booking.id,
        userId: booking.userId,
        resourceId: booking.resourceId,
      };
      this.eventEmitter.emit('booking.canceled', bookingCanceledEvent);
    }

    return booking;
  }

  async cancel(id: number, reason?: string) {
    return this.updateStatus(id, 'CANCELED');
  }

  async confirm(id: number) {
    return this.updateStatus(id, 'CONFIRMED');
  }
}
