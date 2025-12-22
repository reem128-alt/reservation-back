import { ApiProperty } from '@nestjs/swagger';

export class ChartDataPoint {
  @ApiProperty({ example: 'January' })
  label: string;

  @ApiProperty({ example: 1500 })
  value: number;
}

export class ResourceTypeStats {
  @ApiProperty({ example: 'room' })
  type: string;

  @ApiProperty({ example: 'Room' })
  label: string;

  @ApiProperty({ example: 15 })
  totalResources: number;

  @ApiProperty({ example: 120 })
  totalBookings: number;

  @ApiProperty({ example: 25000 })
  totalRevenue: number;

  @ApiProperty({ example: 85.5 })
  utilizationRate: number;
}

export class BookingTrendData {
  @ApiProperty({ example: '2024-12-01' })
  date: string;

  @ApiProperty({ example: 15 })
  bookings: number;

  @ApiProperty({ example: 12 })
  confirmed: number;

  @ApiProperty({ example: 2 })
  pending: number;

  @ApiProperty({ example: 1 })
  canceled: number;
}

export class RevenueAnalytics {
  @ApiProperty({ example: 125000 })
  totalRevenue: number;

  @ApiProperty({ example: 15625 })
  averageRevenuePerBooking: number;

  @ApiProperty({ example: 10416.67 })
  averageMonthlyRevenue: number;

  @ApiProperty({ type: [ChartDataPoint] })
  revenueByMonth: ChartDataPoint[];

  @ApiProperty({ type: [ChartDataPoint] })
  revenueByResourceType: ChartDataPoint[];
}

export class TopResourceData {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'ROOM-101' })
  code: string;

  @ApiProperty({ example: 'Conference Room A' })
  title: string;

  @ApiProperty({ example: 'room' })
  resourceType: string;

  @ApiProperty({ example: 'Room' })
  resourceTypeLabel: string;

  @ApiProperty({ example: 45 })
  bookingCount: number;

  @ApiProperty({ example: 12500 })
  totalRevenue: number;
}

export class UserAnalytics {
  @ApiProperty({ example: 250 })
  totalUsers: number;

  @ApiProperty({ example: 180 })
  activeUsers: number;

  @ApiProperty({ example: 70 })
  inactiveUsers: number;

  @ApiProperty({ type: [ChartDataPoint] })
  userRegistrationTrend: ChartDataPoint[];
}

export class BookingAnalytics {
  @ApiProperty({ example: 450 })
  totalBookings: number;

  @ApiProperty({ example: 350 })
  confirmedBookings: number;

  @ApiProperty({ example: 50 })
  pendingBookings: number;

  @ApiProperty({ example: 50 })
  canceledBookings: number;

  @ApiProperty({ example: 77.8 })
  confirmationRate: number;

  @ApiProperty({ type: [ChartDataPoint] })
  bookingsByStatus: ChartDataPoint[];

  @ApiProperty({ type: [BookingTrendData] })
  bookingTrend: BookingTrendData[];
}

export class ProjectSummaryDto {
  @ApiProperty({ description: 'Overall project statistics' })
  overview: {
    totalUsers: number;
    totalResources: number;
    totalResourceTypes: number;
    totalBookings: number;
    totalRevenue: number;
    activeBookings: number;
  };

  @ApiProperty({ type: BookingAnalytics })
  bookingAnalytics: BookingAnalytics;

  @ApiProperty({ type: RevenueAnalytics })
  revenueAnalytics: RevenueAnalytics;

  @ApiProperty({ type: UserAnalytics })
  userAnalytics: UserAnalytics;

  @ApiProperty({ type: [ResourceTypeStats] })
  resourceTypeStats: ResourceTypeStats[];

  @ApiProperty({ type: [TopResourceData] })
  topResources: TopResourceData[];

  @ApiProperty({ type: [TopResourceData] })
  topRevenueResources: TopResourceData[];
}
