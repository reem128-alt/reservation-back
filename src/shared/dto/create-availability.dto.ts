import { IsInt, IsDateString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAvailabilityDto {
  @ApiProperty({ example: 1, description: 'Resource ID' })
  @IsInt()
  resourceId: number;

  @ApiProperty({ example: '2024-12-15T09:00:00Z', description: 'Start time of availability' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2024-12-15T17:00:00Z', description: 'End time of availability' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ example: true, description: 'Whether this schedule is available for booking', default: true })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
