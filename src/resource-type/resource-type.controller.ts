import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  Query,
  UseGuards 
} from '@nestjs/common';
import { ResourceTypeService } from './resource-type.service';
import { CreateResourceTypeDto } from '../shared/dto/create-resource-type.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { parsePaginationQuery } from '../shared/pagination';

@ApiTags('resource-types')
@ApiBearerAuth()
@Controller('resource-types')
@UseGuards(JwtAuthGuard)
export class ResourceTypeController {
  constructor(private readonly resourceTypeService: ResourceTypeService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new resource type' })
  @ApiResponse({ status: 201, description: 'Resource type created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Resource type with this name already exists' })
  create(@Body() createResourceTypeDto: CreateResourceTypeDto) {
    return this.resourceTypeService.create(createResourceTypeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all resource types' })
  @ApiResponse({ status: 200, description: 'List of all resource types' })
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination = parsePaginationQuery({ search, page, limit });
    return this.resourceTypeService.findAll(pagination);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active resource types' })
  @ApiResponse({ status: 200, description: 'List of active resource types' })
  findActive() {
    return this.resourceTypeService.findActive();
  }

  @Get('name/:name')
  @ApiOperation({ summary: 'Get resource type by name' })
  @ApiParam({ name: 'name', description: 'Resource type name' })
  @ApiResponse({ status: 200, description: 'Resource type details' })
  @ApiResponse({ status: 404, description: 'Resource type not found' })
  findByName(@Param('name') name: string) {
    return this.resourceTypeService.findByName(name);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resource type by ID' })
  @ApiParam({ name: 'id', description: 'Resource type ID' })
  @ApiResponse({ status: 200, description: 'Resource type details' })
  @ApiResponse({ status: 404, description: 'Resource type not found' })
  findOne(@Param('id') id: string) {
    return this.resourceTypeService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a resource type' })
  @ApiParam({ name: 'id', description: 'Resource type ID' })
  @ApiResponse({ status: 200, description: 'Resource type updated successfully' })
  @ApiResponse({ status: 404, description: 'Resource type not found' })
  @ApiResponse({ status: 409, description: 'Resource type with this name already exists' })
  update(@Param('id') id: string, @Body() updateResourceTypeDto: Partial<CreateResourceTypeDto>) {
    return this.resourceTypeService.update(+id, updateResourceTypeDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resource type' })
  @ApiParam({ name: 'id', description: 'Resource type ID' })
  @ApiResponse({ status: 200, description: 'Resource type deleted successfully' })
  @ApiResponse({ status: 404, description: 'Resource type not found' })
  @ApiResponse({ status: 409, description: 'Cannot delete resource type with associated resources' })
  remove(@Param('id') id: string) {
    return this.resourceTypeService.remove(+id);
  }
}
