import { Controller, Post, Body, Get, Patch, UseGuards, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateNotificationSettingsDto } from '../shared/dto/update-notification-settings.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSettings(@Req() req) {
    return this.notificationService.getNotificationSettings(req.user.userId);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user notification settings' })
  @ApiResponse({ status: 200, description: 'Notification settings updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateSettings(@Req() req, @Body() dto: UpdateNotificationSettingsDto) {
    return this.notificationService.updateNotificationSettings(req.user.userId, dto.notificationsEnabled);
  }

  @Post('send')
  async sendNotification(@Body() body: { userId: number; type: string; message: string }) {
    // This would be used for manual notifications
    return { message: 'Notification sent successfully' };
  }

  @Get('test')
  async testNotification() {
    // Test endpoint to verify notification system
    return { status: 'Notification system is working' };
  }
}
