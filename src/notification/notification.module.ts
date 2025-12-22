import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationListeners } from './notification.listeners';
import { PrismaService } from '../auth/prisma.service';

@Module({
  providers: [NotificationService, NotificationListeners, PrismaService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
