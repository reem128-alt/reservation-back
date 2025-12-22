import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import { CreateResourceTypeDto } from '../shared/dto/create-resource-type.dto';
import { buildPaginationMeta, type PaginationParams } from '../shared/pagination';

@Injectable()
export class ResourceTypeService {
  constructor(private prisma: PrismaService) {}

  async create(createResourceTypeDto: CreateResourceTypeDto) {
    const existing = await this.prisma.resourceType.findUnique({
      where: { name: createResourceTypeDto.name },
    });

    if (existing) {
      throw new ConflictException(`Resource type with name "${createResourceTypeDto.name}" already exists`);
    }

    return this.prisma.resourceType.create({
      data: createResourceTypeDto,
      include: {
        _count: {
          select: { resources: true },
        },
      },
    });
  }

  async findAll(pagination?: PaginationParams) {
    const effectivePagination = pagination ?? { page: 1, limit: 100, skip: 0 };

    const where = effectivePagination.search
      ? {
          OR: [
            { name: { contains: effectivePagination.search, mode: 'insensitive' as const } },
            { label: { contains: effectivePagination.search, mode: 'insensitive' as const } },
            { description: { contains: effectivePagination.search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, data] = await Promise.all([
      this.prisma.resourceType.count({ where }),
      this.prisma.resourceType.findMany({
        where,
        skip: effectivePagination.skip,
        take: effectivePagination.limit,
        include: {
          _count: {
            select: { resources: true },
          },
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
    const resourceType = await this.prisma.resourceType.findUnique({
      where: { id },
      include: {
        resources: true,
        _count: {
          select: { resources: true },
        },
      },
    });

    if (!resourceType) {
      throw new NotFoundException(`Resource type with ID ${id} not found`);
    }

    return resourceType;
  }

  async findByName(name: string) {
    const resourceType = await this.prisma.resourceType.findUnique({
      where: { name },
      include: {
        _count: {
          select: { resources: true },
        },
      },
    });

    if (!resourceType) {
      throw new NotFoundException(`Resource type with name "${name}" not found`);
    }

    return resourceType;
  }

  async findActive() {
    return this.prisma.resourceType.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { resources: true },
        },
      },
      orderBy: { label: 'asc' },
    });
  }

  async update(id: number, updateResourceTypeDto: Partial<CreateResourceTypeDto>) {
    const existing = await this.prisma.resourceType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Resource type with ID ${id} not found`);
    }

    if (updateResourceTypeDto.name && updateResourceTypeDto.name !== existing.name) {
      const nameExists = await this.prisma.resourceType.findUnique({
        where: { name: updateResourceTypeDto.name },
      });

      if (nameExists) {
        throw new ConflictException(`Resource type with name "${updateResourceTypeDto.name}" already exists`);
      }
    }

    return this.prisma.resourceType.update({
      where: { id },
      data: updateResourceTypeDto,
      include: {
        _count: {
          select: { resources: true },
        },
      },
    });
  }

  async remove(id: number) {
    const resourceType = await this.prisma.resourceType.findUnique({
      where: { id },
      include: {
        _count: {
          select: { resources: true },
        },
      },
    });

    if (!resourceType) {
      throw new NotFoundException(`Resource type with ID ${id} not found`);
    }

    if (resourceType._count.resources > 0) {
      throw new ConflictException(
        `Cannot delete resource type "${resourceType.label}" because it has ${resourceType._count.resources} associated resources`,
      );
    }

    return this.prisma.resourceType.delete({
      where: { id },
    });
  }
}
