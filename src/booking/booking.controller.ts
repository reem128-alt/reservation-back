import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Patch, 
  Delete,
  UseGuards,
  Req,
  Query
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from '../shared/dto/create-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { parsePaginationQuery } from '../shared/pagination';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createBookingDto: CreateBookingDto, @Req() req) {
    return this.bookingService.create(req.user.userId, createBookingDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings' })
  @ApiResponse({ status: 200, description: 'List of all bookings' })
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination = parsePaginationQuery({ search, page, limit });
    return this.bookingService.findAll(pagination);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current user bookings' })
  @ApiResponse({ status: 200, description: 'List of user bookings' })
  async findMyBookings(@Req() req) {
    return this.bookingService.findByUser(req.user.userId);
  }

  @Get('resource/:resourceId')
  @ApiOperation({ summary: 'Get bookings by resource ID' })
  @ApiParam({ name: 'resourceId', description: 'Resource ID' })
  @ApiResponse({ status: 200, description: 'List of bookings for the resource' })
  findByResource(@Param('resourceId') resourceId: string) {
    return this.bookingService.findByResource(+resourceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking details' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(+id);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking confirmed' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  confirm(@Param('id') id: string) {
    return this.bookingService.confirm(+id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({ status: 200, description: 'Booking cancelled' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  cancel(@Param('id') id: string) {
    return this.bookingService.cancel(+id);
  }
}
