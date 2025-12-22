import { Injectable, BadRequestException } from '@nestjs/common';
import type { BookingConfirmedEvent } from '../shared/events/booking.events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Stripe from 'stripe';
import { PrismaService } from '../auth/prisma.service';
import { buildPaginationMeta, type PaginationParams } from '../shared/pagination';

@Injectable()
export class PaymentService {
  private stripe: Stripe;

  constructor(
    private eventEmitter: EventEmitter2,
    private prisma: PrismaService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-11-17.clover',
    });
  }

  async syncPaymentMethod(userId: number, paymentMethodId: string) {
    const pm = await this.stripe.paymentMethods.retrieve(paymentMethodId);

    const card = (pm as any).card;
    const billingPostalCode = (pm as any).billing_details?.address?.postal_code ?? null;

    const data = {
      id: pm.id,
      userId,
      type: pm.type,
      brand: card?.brand ?? null,
      last4: card?.last4 ?? null,
      expMonth: card?.exp_month ?? null,
      expYear: card?.exp_year ?? null,
      funding: card?.funding ?? null,
      country: card?.country ?? null,
      billingPostalCode,
    };

    return (await (this.prisma.paymentMethod as any).upsert({
      where: { id: pm.id },
      update: data,
      create: data,
      select: {
        id: true,
        type: true,
        brand: true,
        last4: true,
        expMonth: true,
        expYear: true,
        funding: true,
        country: true,
        billingPostalCode: true,
      },
    })) as any;
  }

  async processPayment(bookingId: number, amount: number, paymentMethodId?: string) {
    try {
      console.log(`Processing payment of $${amount} for booking ${bookingId}`);

      // Fetch booking details
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          user: true,
          resource: true,
        },
      });

      if (!booking) {
        throw new BadRequestException('Booking not found');
      }

      // Create Stripe PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amount in cents
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          bookingId: bookingId.toString(),
          userId: booking.userId.toString(),
          resourceId: booking.resourceId.toString(),
        },
        description: `Booking #${bookingId} - ${booking.resource.title}`,
      });

      // If no payment method provided, return client secret for client-side confirmation
      if (!paymentMethodId) {
        console.log('Payment intent created, awaiting client confirmation');
        return {
          success: false,
          requiresAction: true,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount,
          status: 'REQUIRES_PAYMENT_METHOD',
          message: 'Please provide payment method to complete booking',
        };
      }

      // Confirm payment with provided payment method
      const confirmedPayment = await this.stripe.paymentIntents.confirm(
        paymentIntent.id,
        {
          payment_method: paymentMethodId,
        }
      );

      if (confirmedPayment.status === 'succeeded') {
        const paymentMethod = paymentMethodId
          ? await this.syncPaymentMethod(booking.userId, paymentMethodId)
          : null;

        // Save payment to database
        await this.savePaymentToDatabase(
          confirmedPayment.id,
          bookingId,
          amount,
          'COMPLETED',
          `Booking #${bookingId} - ${booking.resource.title}`,
          {
            userId: booking.userId.toString(),
            resourceId: booking.resourceId.toString(),
          },
          paymentMethodId,
          paymentMethod?.id,
        );

        // Emit booking confirmed event after successful payment
        const bookingConfirmedEvent: BookingConfirmedEvent = {
          bookingId,
          userId: booking.userId,
          resourceId: booking.resourceId,
          paymentId: confirmedPayment.id,
        };
        
        this.eventEmitter.emit('booking.confirmed', bookingConfirmedEvent);
        
        return {
          success: true,
          paymentId: confirmedPayment.id,
          amount,
          status: 'COMPLETED',
          clientSecret: paymentIntent.client_secret,
          paymentMethod: paymentMethod
            ? {
                id: paymentMethod.id,
                type: paymentMethod.type,
                brand: paymentMethod.brand,
                last4: paymentMethod.last4,
                expMonth: paymentMethod.expMonth,
                expYear: paymentMethod.expYear,
                funding: paymentMethod.funding,
                country: paymentMethod.country,
                billingPostalCode: paymentMethod.billingPostalCode,
              }
            : null,
        };
      } else {
        // Save payment attempt to database even if not completed
        await this.savePaymentToDatabase(
          confirmedPayment.id,
          bookingId,
          amount,
          confirmedPayment.status.toUpperCase(),
          `Booking #${bookingId} - ${booking.resource.title}`,
          {
            userId: booking.userId.toString(),
            resourceId: booking.resourceId.toString(),
          },
          paymentMethodId,
          undefined,
        );

        return {
          success: false,
          error: 'Payment not completed',
          status: 'FAILED',
        };
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error: error.message || 'Payment processing failed',
        status: 'FAILED',
      };
    }
  }

  async createPaymentIntent(amount: number, bookingId: number) {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { resource: true },
      });

      if (!booking) {
        throw new BadRequestException('Booking not found');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          bookingId: bookingId.toString(),
        },
        description: `Booking #${bookingId} - ${booking.resource.title}`,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to create payment intent: ${error.message}`);
    }
  }

  async refundPayment(paymentId: string, amount?: number) {
    try {
      console.log(`Refunding payment ${paymentId}`);
      
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
      });

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100, // Convert back to dollars
        status: refund.status ? refund.status.toUpperCase() : 'PENDING',
      };
    } catch (error) {
      console.error('Refund error:', error);
      return {
        success: false,
        error: error.message || 'Refund failed',
      };
    }
  }

  async getPaymentStatus(paymentId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
      
      return {
        paymentId: paymentIntent.id,
        status: paymentIntent.status.toUpperCase(),
        amount: paymentIntent.amount / 100, // Convert to dollars
        currency: paymentIntent.currency,
        createdAt: new Date(paymentIntent.created * 1000),
      };
    } catch (error) {
      throw new BadRequestException(`Failed to retrieve payment status: ${error.message}`);
    }
  }

  async processPaymentForBooking(
    bookingData: { userId: number; resourceId: number; startTime: Date; endTime: Date },
    amount: number,
    paymentMethodId: string,
  ) {
    try {
      console.log(`Processing payment of $${amount} for new booking`);

      // Fetch resource details for payment description
      const resource = await this.prisma.resource.findUnique({
        where: { id: bookingData.resourceId },
      });

      if (!resource) {
        throw new BadRequestException('Resource not found');
      }

      // Create Stripe PaymentIntent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amount in cents
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          userId: bookingData.userId.toString(),
          resourceId: bookingData.resourceId.toString(),
          startTime: bookingData.startTime.toISOString(),
          endTime: bookingData.endTime.toISOString(),
        },
        description: `Booking for ${resource.title}`,
      });

      // Confirm payment with provided payment method
      const confirmedPayment = await this.stripe.paymentIntents.confirm(
        paymentIntent.id,
        {
          payment_method: paymentMethodId,
        }
      );

      if (confirmedPayment.status === 'succeeded') {
        return {
          success: true,
          paymentId: confirmedPayment.id,
          amount,
          status: 'COMPLETED',
        };
      } else {
        return {
          success: false,
          error: `Payment status: ${confirmedPayment.status}`,
          status: 'FAILED',
        };
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error: error.message || 'Payment processing failed',
        status: 'FAILED',
      };
    }
  }

  async confirmPaymentIntent(paymentIntentId: string, paymentMethodId: string) {
    try {
      console.log(`Confirming payment intent ${paymentIntentId} with payment method ${paymentMethodId}`);

      // Confirm the payment intent with the provided payment method
      const confirmedPayment = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
        }
      );

      if (confirmedPayment.status === 'succeeded') {
        // Extract booking ID from metadata
        const bookingId = parseInt(confirmedPayment.metadata.bookingId);
        let userId = parseInt(confirmedPayment.metadata.userId);
        let resourceId = parseInt(confirmedPayment.metadata.resourceId);

        if (!Number.isFinite(userId) || !Number.isFinite(resourceId)) {
          const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            select: { userId: true, resourceId: true },
          });
          if (booking) {
            userId = booking.userId;
            resourceId = booking.resourceId;
          }
        }

        const paymentMethod = Number.isFinite(userId)
          ? await this.syncPaymentMethod(userId, paymentMethodId)
          : null;

        // Save payment to database
        await this.savePaymentToDatabase(
          confirmedPayment.id,
          bookingId,
          confirmedPayment.amount / 100,
          'COMPLETED',
          confirmedPayment.description,
          confirmedPayment.metadata,
          paymentMethodId,
          paymentMethod?.id,
        );

        // Emit booking confirmed event
        const bookingConfirmedEvent: BookingConfirmedEvent = {
          bookingId,
          userId,
          resourceId,
          paymentId: confirmedPayment.id,
        };
        
        this.eventEmitter.emit('booking.confirmed', bookingConfirmedEvent);
        
        return {
          success: true,
          paymentId: confirmedPayment.id,
          amount: confirmedPayment.amount / 100,
          status: 'COMPLETED',
          paymentMethod: paymentMethod
            ? {
                id: paymentMethod.id,
                type: paymentMethod.type,
                brand: paymentMethod.brand,
                last4: paymentMethod.last4,
                expMonth: paymentMethod.expMonth,
                expYear: paymentMethod.expYear,
                funding: paymentMethod.funding,
                country: paymentMethod.country,
                billingPostalCode: paymentMethod.billingPostalCode,
              }
            : null,
        };
      } else {
        // Save failed payment attempt to database
        const bookingId = parseInt(confirmedPayment.metadata.bookingId);
        if (bookingId) {
          await this.savePaymentToDatabase(
            confirmedPayment.id,
            bookingId,
            confirmedPayment.amount / 100,
            confirmedPayment.status.toUpperCase(),
            confirmedPayment.description,
            confirmedPayment.metadata,
            paymentMethodId,
          );
        }

        return {
          success: false,
          error: 'Payment not completed',
          status: confirmedPayment.status.toUpperCase(),
        };
      }
    } catch (error) {
      console.error('Payment confirmation error:', error);
      return {
        success: false,
        error: error.message || 'Payment confirmation failed',
        status: 'FAILED',
      };
    }
  }

  async getAllPayments(pagination: PaginationParams): Promise<{ data: any[]; meta: any }>;
  async getAllPayments(limit?: number, offset?: number): Promise<{ data: any[]; meta: any }>;
  async getAllPayments(paginationOrLimit?: PaginationParams | number, offset?: number) {
    try {
      const pagination: PaginationParams =
        typeof paginationOrLimit === 'object' && paginationOrLimit
          ? paginationOrLimit
          : {
              page: 1,
              limit: typeof paginationOrLimit === 'number' ? paginationOrLimit : 50,
              skip: typeof offset === 'number' ? offset : 0,
            };

      const where = pagination.search
        ? {
            OR: [
              { stripePaymentId: { contains: pagination.search, mode: 'insensitive' as const } },
              { status: { contains: pagination.search, mode: 'insensitive' as const } },
              { booking: { resource: { title: { contains: pagination.search, mode: 'insensitive' as const } } } },
              { booking: { user: { email: { contains: pagination.search, mode: 'insensitive' as const } } } },
            ],
          }
        : undefined;

      const payments = await this.prisma.payment.findMany({
        where,
        take: pagination.limit,
        skip: pagination.skip,
        include: {
          paymentMethodDetails: {
            select: {
              id: true,
              type: true,
              brand: true,
              last4: true,
              expMonth: true,
              expYear: true,
              funding: true,
              country: true,
              billingPostalCode: true,
            },
          },
          booking: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
              resource: {
                select: {
                  id: true,
                  title: true,
                  code: true,
                  resourceType: {
                    select: {
                      name: true,
                      label: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const total = await this.prisma.payment.count({ where });

      return {
        data: payments,
        meta: buildPaginationMeta({ total, page: pagination.page, limit: pagination.limit }),
      };
    } catch (error) {
      console.error('Error fetching all payments from database:', error);
      throw new BadRequestException(`Failed to retrieve payments: ${error.message}`);
    }
  }

  private async savePaymentToDatabase(
    stripePaymentId: string,
    bookingId: number,
    amount: number,
    status: string,
    description?: string | null,
    metadata?: any,
    paymentMethod?: string | null,
    paymentMethodId?: string | null,
  ) {
    try {
      await (this.prisma.payment as any).create({
        data: {
          stripePaymentId,
          bookingId,
          amount,
          currency: 'usd',
          status,
          description: description || undefined,
          metadata,
          paymentMethod: paymentMethod || undefined,
          paymentMethodId: paymentMethodId || undefined,
        },
      });
    } catch (error) {
      console.error('Error saving payment to database:', error);
      // Don't throw here to avoid breaking the payment flow
    }
  }
}
