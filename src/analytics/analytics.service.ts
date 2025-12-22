import { Injectable } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import {
  ProjectSummaryDto,
  ChartDataPoint,
  ResourceTypeStats,
  BookingTrendData,
  RevenueAnalytics,
  TopResourceData,
  UserAnalytics,
  BookingAnalytics,
} from './dto/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getProjectSummary(): Promise<ProjectSummaryDto> {
    const [
      totalUsers,
      totalResources,
      totalResourceTypes,
      totalBookings,
      bookings,
      payments,
      resourceTypes,
      users,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.resource.count(),
      this.prisma.resourceType.count(),
      this.prisma.booking.count(),
      this.prisma.booking.findMany({
        select: {
          id: true,
          status: true,
          createdAt: true,
          startTime: true,
          endTime: true,
          resourceId: true,
          payment: {
            select: {
              amount: true,
            },
          },
          resource: {
            select: {
              id: true,
              code: true,
              title: true,
              resourceType: {
                select: {
                  name: true,
                  label: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        select: {
          amount: true,
          createdAt: true,
          booking: {
            select: {
              resource: {
                select: {
                  resourceType: {
                    select: {
                      name: true,
                      label: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.resourceType.findMany({
        include: {
          resources: {
            include: {
              bookings: {
                include: {
                  payment: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.findMany({
        select: {
          id: true,
          createdAt: true,
          bookings: {
            select: {
              id: true,
            },
          },
        },
      }),
    ]);

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const activeBookings = bookings.filter(
      (b) => b.status === 'CONFIRMED' && new Date(b.endTime) > new Date(),
    ).length;

    const overview = {
      totalUsers,
      totalResources,
      totalResourceTypes,
      totalBookings,
      totalRevenue,
      activeBookings,
    };

    const bookingAnalytics = this.calculateBookingAnalytics(bookings);
    const revenueAnalytics = this.calculateRevenueAnalytics(payments, bookings);
    const userAnalytics = this.calculateUserAnalytics(users);
    const resourceTypeStats = this.calculateResourceTypeStats(resourceTypes);
    const topResources = this.calculateTopResources(bookings, 10);
    const topRevenueResources = this.calculateTopRevenueResources(bookings, 10);

    return {
      overview,
      bookingAnalytics,
      revenueAnalytics,
      userAnalytics,
      resourceTypeStats,
      topResources,
      topRevenueResources,
    };
  }

  private calculateBookingAnalytics(bookings: any[]): BookingAnalytics {
    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter((b) => b.status === 'CONFIRMED').length;
    const pendingBookings = bookings.filter((b) => b.status === 'PENDING').length;
    const canceledBookings = bookings.filter((b) => b.status === 'CANCELED').length;
    const confirmationRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;

    const bookingsByStatus: ChartDataPoint[] = [
      { label: 'Confirmed', value: confirmedBookings },
      { label: 'Pending', value: pendingBookings },
      { label: 'Canceled', value: canceledBookings },
    ];

    const bookingTrend = this.calculateBookingTrend(bookings);

    return {
      totalBookings,
      confirmedBookings,
      pendingBookings,
      canceledBookings,
      confirmationRate: Math.round(confirmationRate * 100) / 100,
      bookingsByStatus,
      bookingTrend,
    };
  }

  private calculateBookingTrend(bookings: any[]): BookingTrendData[] {
    const trendMap = new Map<string, { total: number; confirmed: number; pending: number; canceled: number }>();

    bookings.forEach((booking) => {
      const date = new Date(booking.createdAt).toISOString().split('T')[0];
      const current = trendMap.get(date) || { total: 0, confirmed: 0, pending: 0, canceled: 0 };
      
      current.total++;
      if (booking.status === 'CONFIRMED') current.confirmed++;
      if (booking.status === 'PENDING') current.pending++;
      if (booking.status === 'CANCELED') current.canceled++;
      
      trendMap.set(date, current);
    });

    return Array.from(trendMap.entries())
      .map(([date, stats]) => ({
        date,
        bookings: stats.total,
        confirmed: stats.confirmed,
        pending: stats.pending,
        canceled: stats.canceled,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateRevenueAnalytics(payments: any[], bookings: any[]): RevenueAnalytics {
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const paidBookingsCount = bookings.filter((b) => b.payment).length;
    const averageRevenuePerBooking = paidBookingsCount > 0 ? totalRevenue / paidBookingsCount : 0;

    const monthlyRevenueMap = new Map<string, number>();
    payments.forEach((payment) => {
      const date = new Date(payment.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenueMap.set(monthKey, (monthlyRevenueMap.get(monthKey) || 0) + payment.amount);
    });

    const revenueByMonth: ChartDataPoint[] = Array.from(monthlyRevenueMap.entries())
      .map(([month, revenue]) => ({
        label: month,
        value: Math.round(revenue * 100) / 100,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const averageMonthlyRevenue = revenueByMonth.length > 0
      ? totalRevenue / revenueByMonth.length
      : 0;

    const revenueByTypeMap = new Map<string, number>();
    payments.forEach((payment) => {
      const typeLabel = payment.booking?.resource?.resourceType?.label || 'Unknown';
      revenueByTypeMap.set(typeLabel, (revenueByTypeMap.get(typeLabel) || 0) + payment.amount);
    });

    const revenueByResourceType: ChartDataPoint[] = Array.from(revenueByTypeMap.entries())
      .map(([label, value]) => ({
        label,
        value: Math.round(value * 100) / 100,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      averageRevenuePerBooking: Math.round(averageRevenuePerBooking * 100) / 100,
      averageMonthlyRevenue: Math.round(averageMonthlyRevenue * 100) / 100,
      revenueByMonth,
      revenueByResourceType,
    };
  }

  private calculateUserAnalytics(users: any[]): UserAnalytics {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.bookings.length > 0).length;
    const inactiveUsers = totalUsers - activeUsers;

    const registrationMap = new Map<string, number>();
    users.forEach((user) => {
      const date = new Date(user.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      registrationMap.set(monthKey, (registrationMap.get(monthKey) || 0) + 1);
    });

    const userRegistrationTrend: ChartDataPoint[] = Array.from(registrationMap.entries())
      .map(([month, count]) => ({
        label: month,
        value: count,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      userRegistrationTrend,
    };
  }

  private calculateResourceTypeStats(resourceTypes: any[]): ResourceTypeStats[] {
    return resourceTypes.map((rt) => {
      const totalResources = rt.resources.length;
      const totalBookings = rt.resources.reduce(
        (sum: number, r: any) => sum + r.bookings.length,
        0,
      );
      const totalRevenue = rt.resources.reduce(
        (sum: number, r: any) =>
          sum +
          r.bookings.reduce(
            (bSum: number, b: any) => bSum + (b.payment?.amount || 0),
            0,
          ),
        0,
      );

      const confirmedBookings = rt.resources.reduce(
        (sum: number, r: any) =>
          sum + r.bookings.filter((b: any) => b.status === 'CONFIRMED').length,
        0,
      );
      const utilizationRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;

      return {
        type: rt.name,
        label: rt.label,
        totalResources,
        totalBookings,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
      };
    });
  }

  private calculateTopResources(bookings: any[], limit: number): TopResourceData[] {
    const resourceMap = new Map<number, any>();

    bookings.forEach((booking) => {
      const resourceId = booking.resource.id;
      if (!resourceMap.has(resourceId)) {
        resourceMap.set(resourceId, {
          id: booking.resource.id,
          code: booking.resource.code,
          title: booking.resource.title,
          resourceType: booking.resource.resourceType.name,
          resourceTypeLabel: booking.resource.resourceType.label,
          bookingCount: 0,
          totalRevenue: 0,
        });
      }

      const resource = resourceMap.get(resourceId);
      resource.bookingCount++;
      resource.totalRevenue += booking.payment?.amount || 0;
    });

    return Array.from(resourceMap.values())
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, limit)
      .map((r) => ({
        ...r,
        totalRevenue: Math.round(r.totalRevenue * 100) / 100,
      }));
  }

  private calculateTopRevenueResources(bookings: any[], limit: number): TopResourceData[] {
    const resourceMap = new Map<number, any>();

    bookings.forEach((booking) => {
      const resourceId = booking.resource.id;
      if (!resourceMap.has(resourceId)) {
        resourceMap.set(resourceId, {
          id: booking.resource.id,
          code: booking.resource.code,
          title: booking.resource.title,
          resourceType: booking.resource.resourceType.name,
          resourceTypeLabel: booking.resource.resourceType.label,
          bookingCount: 0,
          totalRevenue: 0,
        });
      }

      const resource = resourceMap.get(resourceId);
      resource.bookingCount++;
      resource.totalRevenue += booking.payment?.amount || 0;
    });

    return Array.from(resourceMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map((r) => ({
        ...r,
        totalRevenue: Math.round(r.totalRevenue * 100) / 100,
      }));
  }
}
