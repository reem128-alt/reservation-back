import { Controller, Post, Body, Get, Param, Patch, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { parsePaginationQuery } from '../shared/pagination';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('process')
  async processPayment(@Body() body: { bookingId: number; amount: number; paymentMethod: string }) {
    return this.paymentService.processPayment(body.bookingId, body.amount, body.paymentMethod);
  }

  @Post('refund')
  async refundPayment(@Body() body: { paymentId: string; amount: number }) {
    return this.paymentService.refundPayment(body.paymentId, body.amount);
  }

  @Get('status/:paymentId')
  async getPaymentStatus(@Param('paymentId') paymentId: string) {
    return this.paymentService.getPaymentStatus(paymentId);
  }

  @Patch('confirm')
  async confirmPayment(@Body() body: { paymentIntentId: string; paymentMethodId: string }) {
    return this.paymentService.confirmPaymentIntent(body.paymentIntentId, body.paymentMethodId);
  }

  @Get()
  async getAllPayments(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination = parsePaginationQuery({ search, page, limit }, { defaultLimit: 50 });
    return this.paymentService.getAllPayments(pagination);
  }
}
