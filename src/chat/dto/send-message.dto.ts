import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @ApiProperty({ description: 'Conversation ID (optional for first message)', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  conversationId?: number;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'User ID to send message to (for admin starting conversation)', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
}
