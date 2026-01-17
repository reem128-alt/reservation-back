import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
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
  providers: [AppService],
})
export class AppModule {}
