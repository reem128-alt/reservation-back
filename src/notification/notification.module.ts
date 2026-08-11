import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationListeners } from './notification.listeners';
@Module({
  providers: [NotificationService, NotificationListeners],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
