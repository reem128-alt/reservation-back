import { IsString, IsOptional, IsInt, IsObject, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResourceDto {
  @ApiProperty({ example: 'ROOM-101', description: 'Unique resource code' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Conference Room A', description: 'Resource title' })
  @IsString()
  title: string;

  @ApiProperty({ example: 1, description: 'Resource type ID (reference to ResourceType)' })
  @IsInt()
  resourceTypeId: number;

  @ApiPropertyOptional({ example: 'Large conference room with projector', description: 'Resource description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 20, description: 'Resource capacity' })
  @IsInt()
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: 50.0, description: 'Hourly rate or base price' })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/demo/image/upload/v1234567890/reservation/room.jpg', description: 'Image URL from Cloudinary' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ example: 'Downtown - Main Street 12', description: 'Human-readable location' })
  @IsString()
  @IsOptional()
  locationText?: string;

  @ApiPropertyOptional({ example: 30.0444, description: 'Latitude coordinate' })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 31.2357, description: 'Longitude coordinate' })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: { floor: 2, hasProjector: true }, description: 'Additional metadata' })
  @IsObject()
  @IsOptional()
  meta?: any;
}
