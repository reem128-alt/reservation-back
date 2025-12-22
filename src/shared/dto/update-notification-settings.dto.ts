import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationSettingsDto {
  @ApiProperty({
    example: true,
    description: 'Whether booking notifications are enabled for the user',
  })
  @IsBoolean()
  notificationsEnabled: boolean;
}
