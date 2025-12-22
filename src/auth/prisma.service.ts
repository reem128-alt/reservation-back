import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prisma: PrismaClient;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ 
      connectionString,
      ssl: false // Disable SSL for local PostgreSQL
    });
    const adapter = new PrismaPg(pool);
    this.prisma = new PrismaClient({ adapter });
  }

  get user() {
    return this.prisma.user;
  }

  get otpCode() {
    return (this.prisma as any).otpCode;
  }

  get resource() {
    return this.prisma.resource;
  }

  get resourceType() {
    return this.prisma.resourceType;
  }

  get resourceSchedule() {
    return this.prisma.resourceSchedule;
  }

  get booking() {
    return this.prisma.booking;
  }

  get payment() {
    return this.prisma.payment;
  }

  get paymentMethod() {
    return (this.prisma as any).paymentMethod;
  }

  get chatConversation() {
    return this.prisma.chatConversation;
  }

  get chatMessage() {
    return this.prisma.chatMessage;
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
