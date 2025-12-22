import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkReadDto {
  @ApiProperty({ description: 'Conversation ID' })
  @IsInt()
  conversationId: number;
}
