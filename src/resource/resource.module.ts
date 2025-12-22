import { Module } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { ResourceController } from './resource.controller';
import { PrismaService } from '../auth/prisma.service';

@Module({
  providers: [ResourceService, PrismaService],
  controllers: [ResourceController],
  exports: [ResourceService],
})
export class ResourceModule {}
