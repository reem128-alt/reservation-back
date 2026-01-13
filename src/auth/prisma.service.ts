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
      ssl: connectionString?.includes('render.com') ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection not established
    });
    const adapter = new PrismaPg(pool);
    this.prisma = new PrismaClient({ 
      adapter,
      log: ['error', 'warn'],
    });
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
