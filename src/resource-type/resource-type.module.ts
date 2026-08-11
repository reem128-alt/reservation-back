import { Module } from '@nestjs/common';
import { ResourceTypeService } from './resource-type.service';
import { ResourceTypeController } from './resource-type.controller';
@Module({
  controllers: [ResourceTypeController],
  providers: [ResourceTypeService],
  exports: [ResourceTypeService],
})
export class ResourceTypeModule {}
