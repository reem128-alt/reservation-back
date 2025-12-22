import { Module } from '@nestjs/common';
import { ResourceTypeService } from './resource-type.service';
import { ResourceTypeController } from './resource-type.controller';
import { PrismaService } from '../auth/prisma.service';

@Module({
  controllers: [ResourceTypeController],
  providers: [ResourceTypeService, PrismaService],
  exports: [ResourceTypeService],
})
export class ResourceTypeModule {}
