import { Injectable } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getDetailedStatistics() {
    const [
      totalUsers,
      totalBookings,
      bookings,
      payments,
      topResourcesData,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.booking.count(),
      this.prisma.booking.findMany({
        select: {
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.payment.findMany({
        select: {
          amount: true,
          createdAt: true,
        },
      }),
      this.prisma.booking.groupBy({
        by: ['resourceId'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      }),
    ]);

    const bookingsByStatus = bookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const revenueByMonth = this.calculateRevenueByMonth(payments);

    const topResources = await Promise.all(
      topResourcesData.map(async (item) => {
        const resource = await this.prisma.resource.findUnique({
          where: { id: item.resourceId },
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
        });
        return {
          ...resource,
          bookingCount: item._count.id,
        };
      }),
    );

    const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);

    return {
      totalUsers,
      totalBookings,
      totalRevenue,
      bookingsByStatus,
      revenueByMonth,
      topResources,
    };
  }

  private calculateRevenueByMonth(payments: Array<{ amount: number; createdAt: Date }>) {
    const monthlyRevenue = new Map<string, number>();

    payments.forEach((payment) => {
      const date = new Date(payment.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + payment.amount);
    });

    return Array.from(monthlyRevenue.entries())
      .map(([month, revenue]) => ({
        month,
        revenue,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
