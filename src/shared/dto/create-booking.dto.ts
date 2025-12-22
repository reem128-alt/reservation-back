import { IsInt, IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: 1, description: 'User ID' })
  @IsInt()
  userId: number;

  @ApiProperty({ example: 1, description: 'Resource ID' })
  @IsInt()
  resourceId: number;

  @ApiProperty({ example: '2024-12-01T10:00:00Z', description: 'Booking start time (ISO 8601)' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2024-12-01T12:00:00Z', description: 'Booking end time (ISO 8601)' })
  @IsDateString()
  endTime: string;

  @ApiProperty({ 
    example: 'pm_1234567890', 
    description: 'Stripe Payment Method ID (optional - if not provided, returns payment intent for client-side confirmation)',
    required: false 
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}
