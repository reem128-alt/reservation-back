import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import { CreateUserDto, Role } from '../shared/dto/create-user.dto';
import { UpdateUserDto } from '../shared/dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { buildPaginationMeta, type PaginationParams } from '../shared/pagination';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { email, password, name, image, role = Role.USER } = createUserDto;
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        image,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });
  }

  async findAll(pagination?: PaginationParams) {
    const effectivePagination = pagination ?? { page: 1, limit: 100, skip: 0 };

    const where = effectivePagination.search
      ? {
          OR: [
            { email: { contains: effectivePagination.search, mode: 'insensitive' as const } },
            { name: { contains: effectivePagination.search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip: effectivePagination.skip,
        take: effectivePagination.limit,
        select: {
          id: true,
          email: true,
          name: true,
          image:true,
          role: true,
          emailVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

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
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const data: any = {};
    if (updateUserDto.email) data.email = updateUserDto.email;
    if (updateUserDto.name !== undefined) data.name = updateUserDto.name;
    if (updateUserDto.image !== undefined) data.image = updateUserDto.image;
    if (updateUserDto.role) data.role = updateUserDto.role;
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // Check if exists
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
