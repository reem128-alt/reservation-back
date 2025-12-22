import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateResourceTypeDto {
  @ApiProperty({ example: 'room', description: 'Unique name identifier for the resource type' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Hotel Room', description: 'Display label for the resource type' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ example: 'Bookable hotel rooms and suites', description: 'Description of the resource type' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'bed', description: 'Icon name or URL' })
  @IsString()
  @IsOptional()
  icon?: string;


  @ApiPropertyOptional({ example: true, description: 'Whether this resource type is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
