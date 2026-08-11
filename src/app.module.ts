import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ResourceModule } from './resource/resource.module';
import { ResourceTypeModule } from './resource-type/resource-type.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingModule } from './booking/booking.module';
import { PaymentModule } from './payment/payment.module';
import { NotificationModule } from './notification/notification.module';
import { UserModule } from './user/user.module';
import { StatisticsModule } from './statistics/statistics.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ChatModule } from './chat/chat.module';
import { LoggerModule } from './shared/logger/logger.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000, // Time window: 60 seconds (1 minute)
      limit: 10, // Max 10 requests per minute per IP
    }]),
    PrismaModule,
    LoggerModule,
    AuthModule,
    ResourceTypeModule,
    ResourceModule,
    AvailabilityModule,
    BookingModule,
    PaymentModule,
    NotificationModule,
    UserModule,
    StatisticsModule,
    AnalyticsModule,
    CloudinaryModule,
    ChatModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Apply throttler globally
    },
  ],
})
export class AppModule {}
