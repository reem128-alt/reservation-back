import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import { CreateAvailabilityDto } from '../shared/dto/create-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  private overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
    return startA < endB && endA > startB;
  }

  async createAvailability(createAvailabilityDto: CreateAvailabilityDto) {
    const { resourceId, startTime, endTime, isAvailable = true } = createAvailabilityDto;

    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${resourceId} not found`);
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      throw new BadRequestException('Start time must be before end time');
    }

    const overlappingSchedules = await this.prisma.resourceSchedule.findMany({
      where: {
        resourceId,
        OR: [
          {
            AND: [
              { startTime: { lte: start } },
              { endTime: { gt: start } },
            ],
          },
          {
            AND: [
              { startTime: { lt: end } },
              { endTime: { gte: end } },
            ],
          },
          {
            AND: [
              { startTime: { gte: start } },
              { endTime: { lte: end } },
            ],
          },
        ],
      },
    });

    if (overlappingSchedules.length > 0) {
      throw new BadRequestException('This time slot overlaps with existing availability schedules');
    }

    return this.prisma.resourceSchedule.create({
      data: {
        resourceId,
        startTime: start,
        endTime: end,
        isAvailable,
      },
      include: {
        resource: true,
      },
    });
  }

  async checkAvailability(resourceId: number, startTime: Date, endTime: Date) {
    // Check if resource exists
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${resourceId} not found`);
    }

    // Calculate cost based on duration and resource price
    const durationInHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const estimatedCost = durationInHours * resource.price;

    // Check for overlapping bookings
    const overlappingBookings = await this.prisma.booking.findMany({
      where: {
        resourceId,
        OR: [
          {
            AND: [
              { startTime: { lte: startTime } },
              { endTime: { gt: startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
          {
            AND: [
              { startTime: { gte: startTime } },
              { endTime: { lte: endTime } },
            ],
          },
        ],
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
    });

    return {
      available: overlappingBookings.length === 0,
      resourceId,
      requestedTime: {
        startTime,
        endTime,
      },
      pricing: {
        pricePerHour: resource.price,
        durationInHours: parseFloat(durationInHours.toFixed(2)),
        estimatedCost: parseFloat(estimatedCost.toFixed(2)),
        currency: 'USD',
      },
      conflictingBookings: overlappingBookings,
    };
  }

  async getResourceSchedule(resourceId: number, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.resourceSchedule.findMany({
      where: {
        resourceId,
        startTime: { lt: endOfDay },
        endTime: { gt: startOfDay },
        isAvailable: true,
      },
      include: {
        resource: true,
      },
    });
  }

  async getAvailableTimeSlots(resourceId: number, date: Date, duration: number) {
    const schedules = await this.getResourceSchedule(resourceId, date);
    const bookings = await this.getBookingsForDate(resourceId, date);

    // Fetch resource to get pricing
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      throw new NotFoundException(`Resource with ID ${resourceId} not found`);
    }

    const availableSlots: { startTime: Date; endTime: Date; cost: number }[] = [];

    // Calculate cost per slot based on duration
    const durationInHours = duration / (1000 * 60 * 60);
    const costPerSlot = parseFloat((durationInHours * resource.price).toFixed(2));

    for (const schedule of schedules) {
      const bookedSlots = bookings
        .filter(booking => this.overlaps(
          booking.startTime,
          booking.endTime,
          schedule.startTime,
          schedule.endTime,
        ))
        .map(booking => ({
          start: booking.startTime,
          end: booking.endTime,
        }));

      const slots = this.generateAvailableSlots(
        schedule.startTime,
        schedule.endTime,
        bookedSlots,
        duration,
      );

      // Add cost to each slot
      const slotsWithCost = slots.map(slot => ({
        ...slot,
        cost: costPerSlot,
      }));

      availableSlots.push(...slotsWithCost);
    }

    return {
      resourceId,
      date,
      slotDurationMinutes: duration / (1000 * 60),
      pricing: {
        pricePerHour: resource.price,
        costPerSlot,
        currency: 'USD',
      },
      availableSlots,
    };
  }

  private async getBookingsForDate(resourceId: number, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.booking.findMany({
      where: {
        resourceId,
        startTime: { lt: endOfDay },
        endTime: { gt: startOfDay },
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
    });
  }

  private generateAvailableSlots(
    scheduleStart: Date,
    scheduleEnd: Date,
    bookedSlots: { start: Date; end: Date }[],
    duration: number,
  ) {
    const slots: { startTime: Date; endTime: Date }[] = [];
    let currentTime = new Date(scheduleStart);

    while (currentTime.getTime() + duration <= scheduleEnd.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + duration);

      const isBooked = bookedSlots.some(booked => 
        this.overlaps(currentTime, slotEnd, booked.start, booked.end)
      );

      if (!isBooked) {
        slots.push({
          startTime: new Date(currentTime),
          endTime: new Date(slotEnd),
        });
      }

      currentTime = slotEnd;
    }

    return slots;
  }
}
