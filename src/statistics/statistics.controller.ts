import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('statistics')
@ApiBearerAuth()
@Controller('statistics')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('detailed')
  @ApiOperation({ summary: 'Get detailed statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns detailed statistics including users, bookings, revenue, and top resources',
    schema: {
      type: 'object',
      properties: {
        totalUsers: { type: 'number', example: 150 },
        totalBookings: { type: 'number', example: 320 },
        totalRevenue: { type: 'number', example: 45000.50 },
        bookingsByStatus: { 
          type: 'object',
          example: { PENDING: 10, CONFIRMED: 250, CANCELED: 60 }
        },
        revenueByMonth: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              month: { type: 'string', example: '2024-12' },
              revenue: { type: 'number', example: 5000 }
            }
          }
        },
        topResources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              code: { type: 'string' },
              title: { type: 'string' },
              type: { type: 'string' },
              bookingCount: { type: 'number' }
            }
          }
        }
      }
    }
  })
  async getDetailedStatistics() {
    return this.statisticsService.getDetailedStatistics();
  }
}
