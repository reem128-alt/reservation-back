import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

export class UpdateConversationDto {
  @ApiProperty({ enum: ConversationStatus })
  @IsEnum(ConversationStatus)
  status: ConversationStatus;
}
