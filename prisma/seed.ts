import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Start seeding...');

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  const user1 = await prisma.user.create({
    data: {
      email: 'john@example.com',
      password: hashedPassword,
      name: 'John Doe',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'jane@example.com',
      password: hashedPassword,
      name: 'Jane Smith',
    },
  });

  console.log('Created users:', { user1, user2 });

  // Create resource types
  const roomType = await prisma.resourceType.create({
    data: {
      name: 'room',
      label: 'Room',
      description: 'Meeting rooms and conference spaces',
      icon: 'door-open',
    },
  });

  const carType = await prisma.resourceType.create({
    data: {
      name: 'car',
      label: 'Vehicle',
      description: 'Company vehicles for business use',
      icon: 'car',
    },
  });

  const doctorType = await prisma.resourceType.create({
    data: {
      name: 'doctor',
      label: 'Doctor',
      description: 'Medical practitioners',
      icon: 'stethoscope',
    },
  });

  console.log('Created resource types:', { roomType, carType, doctorType });

  // Create sample resources
  const room1 = await prisma.resource.create({
    data: {
      code: 'ROOM-101',
      title: 'Conference Room A',
      resourceTypeId: roomType.id,
      description: 'Large conference room with projector',
      capacity: 20,
      meta: {
        equipment: ['projector', 'whiteboard', 'video_conference'],
        floor: 1,
        building: 'Main Building',
      },
    },
  });

  const room2 = await prisma.resource.create({
    data: {
      code: 'ROOM-201',
      title: 'Meeting Room B',
      resourceTypeId: roomType.id,
      description: 'Small meeting room for teams',
      capacity: 8,
      meta: {
        equipment: ['whiteboard', 'tv'],
        floor: 2,
        building: 'Main Building',
      },
    },
  });

  const car1 = await prisma.resource.create({
    data: {
      code: 'CAR-AX12',
      title: 'Toyota Camry',
      resourceTypeId: carType.id,
      description: 'Sedan for business trips',
      capacity: 5,
      meta: {
        brand: 'Toyota',
        model: 'Camry',
        year: 2023,
        color: 'Silver',
        license_plate: 'ABC-1234',
      },
    },
  });

  const doctor1 = await prisma.resource.create({
    data: {
      code: 'DOC-001',
      title: 'Dr. Sarah Johnson',
      resourceTypeId: doctorType.id,
      description: 'General practitioner',
      capacity: 1,
      meta: {
        specialty: 'General Practice',
        experience: 10,
        languages: ['English', 'Spanish'],
      },
    },
  });

  console.log('Created resources:', { room1, room2, car1, doctor1 });

  // Create sample schedules
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Room schedules for next week
  for (let i = 0; i < 7; i++) {
    const scheduleDate = new Date(today);
    scheduleDate.setDate(scheduleDate.getDate() + i);
    
    // Room 101 - Available 9 AM to 6 PM
    await prisma.resourceSchedule.create({
      data: {
        resourceId: room1.id,
        startTime: new Date(scheduleDate.setHours(9, 0, 0, 0)),
        endTime: new Date(scheduleDate.setHours(18, 0, 0, 0)),
        isAvailable: true,
      },
    });

    // Room 201 - Available 8 AM to 5 PM
    await prisma.resourceSchedule.create({
      data: {
        resourceId: room2.id,
        startTime: new Date(scheduleDate.setHours(8, 0, 0, 0)),
        endTime: new Date(scheduleDate.setHours(17, 0, 0, 0)),
        isAvailable: true,
      },
    });

    // Car 1 - Available 24/7
    await prisma.resourceSchedule.create({
      data: {
        resourceId: car1.id,
        startTime: new Date(scheduleDate.setHours(0, 0, 0, 0)),
        endTime: new Date(scheduleDate.setHours(23, 59, 59, 999)),
        isAvailable: true,
      },
    });

    // Doctor 1 - Available 9 AM to 5 PM weekdays
    if (scheduleDate.getDay() >= 1 && scheduleDate.getDay() <= 5) {
      await prisma.resourceSchedule.create({
        data: {
          resourceId: doctor1.id,
          startTime: new Date(scheduleDate.setHours(9, 0, 0, 0)),
          endTime: new Date(scheduleDate.setHours(17, 0, 0, 0)),
          isAvailable: true,
        },
      });
    }
  }

  console.log('Created schedules');

  // Create sample bookings
  const booking1 = await prisma.booking.create({
    data: {
      userId: user1.id,
      resourceId: room1.id,
      startTime: new Date(tomorrow.setHours(10, 0, 0, 0)),
      endTime: new Date(tomorrow.setHours(12, 0, 0, 0)),
      status: 'CONFIRMED',
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      userId: user2.id,
      resourceId: car1.id,
      startTime: new Date(tomorrow.setHours(14, 0, 0, 0)),
      endTime: new Date(tomorrow.setHours(18, 0, 0, 0)),
      status: 'PENDING',
    },
  });

  console.log('Created bookings:', { booking1, booking2 });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
