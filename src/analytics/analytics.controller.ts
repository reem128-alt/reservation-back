import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectSummaryDto } from './dto/analytics-response.dto';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ 
    summary: 'Get comprehensive project analytics summary',
    description: 'Returns complete analytics data including bookings, revenue, users, and resource statistics formatted for charts and dashboards'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns comprehensive project analytics with chart-ready data',
    type: ProjectSummaryDto
  })
  async getProjectSummary(): Promise<ProjectSummaryDto> {
    return this.analyticsService.getProjectSummary();
  }
}
