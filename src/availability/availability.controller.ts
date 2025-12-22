import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from '../shared/dto/create-availability.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('availability')
@ApiBearerAuth()
@Controller('availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post()
  @ApiOperation({ summary: 'Add availability schedule to a resource' })
  @ApiResponse({ status: 201, description: 'Availability schedule created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid time range or overlapping schedule' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async createAvailability(@Body() createAvailabilityDto: CreateAvailabilityDto) {
    return this.availabilityService.createAvailability(createAvailabilityDto);
  }

  @Get('check/:resourceId')
  @ApiOperation({ summary: 'Check if a resource is available for a time period' })
  @ApiParam({ name: 'resourceId', description: 'Resource ID' })
  @ApiQuery({ name: 'startTime', description: 'Start time (ISO 8601)', example: '2024-12-01T10:00:00Z' })
  @ApiQuery({ name: 'endTime', description: 'End time (ISO 8601)', example: '2024-12-01T12:00:00Z' })
  @ApiResponse({ status: 200, description: 'Availability status' })
  async checkAvailability(
    @Param('resourceId') resourceId: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.availabilityService.checkAvailability(
      +resourceId,
      new Date(startTime),
      new Date(endTime),
    );
  }

  @Get('schedule/:resourceId')
  @ApiOperation({ summary: 'Get resource schedule for a specific date' })
  @ApiParam({ name: 'resourceId', description: 'Resource ID' })
  @ApiQuery({ name: 'date', description: 'Date (ISO 8601)', example: '2024-12-01' })
  @ApiResponse({ status: 200, description: 'Resource schedule' })
  async getSchedule(
    @Param('resourceId') resourceId: string,
    @Query('date') date: string,
  ) {
    return this.availabilityService.getResourceSchedule(
      +resourceId,
      new Date(date),
    );
  }

  @Get('slots/:resourceId')
  @ApiOperation({ summary: 'Get available time slots for a resource' })
  @ApiParam({ name: 'resourceId', description: 'Resource ID' })
  @ApiQuery({ name: 'date', description: 'Date (ISO 8601)', example: '2024-12-01' })
  @ApiQuery({ name: 'duration', description: 'Slot duration in minutes', example: '60' })
  @ApiResponse({ status: 200, description: 'List of available time slots' })
  async getAvailableSlots(
    @Param('resourceId') resourceId: string,
    @Query('date') date: string,
    @Query('duration') duration: string,
  ) {
    return this.availabilityService.getAvailableTimeSlots(
      +resourceId,
      new Date(date),
      parseInt(duration) * 60 * 1000, // Convert minutes to milliseconds
    );
  }
}
