import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import { CreateResourceDto } from '../shared/dto/create-resource.dto';
import { buildPaginationMeta, type PaginationParams } from '../shared/pagination';

@Injectable()
export class ResourceService {
  constructor(private prisma: PrismaService) {}

  private overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
    return startA < endB && endA > startB;
  }

  async create(createResourceDto: CreateResourceDto) {
    return this.prisma.resource.create({
      data: createResourceDto,
      include: {
        resourceType: true,
        schedules: true,
        bookings: true,
      },
    });
  }

  async findAll(pagination?: PaginationParams) {
    const effectivePagination = pagination ?? { page: 1, limit: 100, skip: 0 };

    const where = effectivePagination.search
      ? {
          OR: [
            {locationText: { contains: effectivePagination.search, mode: 'insensitive' as const } },
            { title: { contains: effectivePagination.search, mode: 'insensitive' as const } },
            { code: { contains: effectivePagination.search, mode: 'insensitive' as const } },
            { resourceType: { name: { contains: effectivePagination.search, mode: 'insensitive' as const } } },
          ],
        }
      : undefined;

    const [total, resources] = await Promise.all([
      this.prisma.resource.count({ where }),
      this.prisma.resource.findMany({
        where,
        skip: effectivePagination.skip,
        take: effectivePagination.limit,
        include: {
          resourceType: true,
          schedules: true,
          bookings: {
            where: {
              status: {
                in: ['PENDING', 'CONFIRMED'],
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const data = resources.map(resource => {
      const schedulesWithAvailability = resource.schedules.map(schedule => {
        const hasOverlappingBooking = resource.bookings.some(booking =>
          this.overlaps(
            schedule.startTime,
            schedule.endTime,
            booking.startTime,
            booking.endTime,
          ),
        );

        const durationInHours = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
        const estimatedCost = parseFloat((durationInHours * resource.price).toFixed(2));

        return {
          ...schedule,
          isAvailable: schedule.isAvailable && !hasOverlappingBooking,
          pricing: {
            durationInHours: parseFloat(durationInHours.toFixed(2)),
            estimatedCost,
            pricePerHour: resource.price,
            currency: 'USD',
          },
        };
      });

      return {
        ...resource,
        schedules: schedulesWithAvailability,
      };
    });

    return {
      data,
      meta: buildPaginationMeta({
        total,
        page: effectivePagination.page,
        limit: effectivePagination.limit,
      }),
    };
  }

  async findOne(id: number) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        resourceType: true,
        schedules: true,
        bookings: {
          where: {
            status: {
              in: ['PENDING', 'CONFIRMED'],
            },
          },
        },
      },
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${id} not found`);
    }

    const schedulesWithAvailability = resource.schedules.map(schedule => {
      const hasOverlappingBooking = resource.bookings.some(booking =>
        this.overlaps(
          schedule.startTime,
          schedule.endTime,
          booking.startTime,
          booking.endTime,
        ),
      );

      const durationInHours = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
      const estimatedCost = parseFloat((durationInHours * resource.price).toFixed(2));

      return {
        ...schedule,
        isAvailable: schedule.isAvailable && !hasOverlappingBooking,
        pricing: {
          durationInHours: parseFloat(durationInHours.toFixed(2)),
          estimatedCost,
          pricePerHour: resource.price,
          currency: 'USD',
        },
      };
    });

    return {
      ...resource,
      schedules: schedulesWithAvailability,
    };
  }

  async update(id: number, updateResourceDto: Partial<CreateResourceDto>) {
    return this.prisma.resource.update({
      where: { id },
      data: updateResourceDto,
      include: {
        resourceType: true,
        schedules: true,
        bookings: true,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.resource.delete({
      where: { id },
    });
  }

  async findByType(type: string) {
    const resources = await this.prisma.resource.findMany({
      where: { 
        resourceType: {
          name: type
        }
      },
      include: {
        resourceType: true,
        schedules: true,
        bookings: {
          where: {
            status: {
              in: ['PENDING', 'CONFIRMED'],
            },
          },
        },
      },
    });

    return resources.map(resource => {
      const schedulesWithAvailability = resource.schedules.map(schedule => {
        const hasOverlappingBooking = resource.bookings.some(booking =>
          this.overlaps(
            schedule.startTime,
            schedule.endTime,
            booking.startTime,
            booking.endTime,
          ),
        );

        const durationInHours = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
        const estimatedCost = parseFloat((durationInHours * resource.price).toFixed(2));

        return {
          ...schedule,
          isAvailable: schedule.isAvailable && !hasOverlappingBooking,
          pricing: {
            durationInHours: parseFloat(durationInHours.toFixed(2)),
            estimatedCost,
            pricePerHour: resource.price,
            currency: 'USD',
          },
        };
      });

      return {
        ...resource,
        schedules: schedulesWithAvailability,
      };
    });
  }

  async findByCode(code: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { code },
      include: {
        resourceType: true,
        schedules: true,
        bookings: {
          where: {
            status: {
              in: ['PENDING', 'CONFIRMED'],
            },
          },
        },
      },
    });

    if (!resource) {
      return null;
    }

    const schedulesWithAvailability = resource.schedules.map(schedule => {
      const hasOverlappingBooking = resource.bookings.some(booking =>
        this.overlaps(
          schedule.startTime,
          schedule.endTime,
          booking.startTime,
          booking.endTime,
        ),
      );

      const durationInHours = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
      const estimatedCost = parseFloat((durationInHours * resource.price).toFixed(2));

      return {
        ...schedule,
        isAvailable: schedule.isAvailable && !hasOverlappingBooking,
        pricing: {
          durationInHours: parseFloat(durationInHours.toFixed(2)),
          estimatedCost,
          pricePerHour: resource.price,
          currency: 'USD',
        },
      };
    });

    return {
      ...resource,
      schedules: schedulesWithAvailability,
    };
  }
}
