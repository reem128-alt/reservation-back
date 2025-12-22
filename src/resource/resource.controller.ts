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
import { ResourceService } from './resource.service';
import { CreateResourceDto } from '../shared/dto/create-resource.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { parsePaginationQuery } from '../shared/pagination';

@ApiTags('resources')
@ApiBearerAuth()
@Controller('resources')
@UseGuards(JwtAuthGuard)
export class ResourceController {
  constructor(private readonly resourceService: ResourceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new resource' })
  @ApiResponse({ status: 201, description: 'Resource created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createResourceDto: CreateResourceDto) {
    return this.resourceService.create(createResourceDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all resources' })
  @ApiResponse({ status: 200, description: 'List of all resources' })
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination = parsePaginationQuery({ search, page, limit });
    return this.resourceService.findAll(pagination);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Get resources by type' })
  @ApiParam({ name: 'type', description: 'Resource type (e.g., room, car, table)' })
  @ApiResponse({ status: 200, description: 'List of resources of the specified type' })
  findByType(@Param('type') type: string) {
    return this.resourceService.findByType(type);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get resource by code' })
  @ApiParam({ name: 'code', description: 'Unique resource code' })
  @ApiResponse({ status: 200, description: 'Resource details' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  findByCode(@Param('code') code: string) {
    return this.resourceService.findByCode(code);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resource by ID' })
  @ApiParam({ name: 'id', description: 'Resource ID' })
  @ApiResponse({ status: 200, description: 'Resource details' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  findOne(@Param('id') id: string) {
    return this.resourceService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a resource' })
  @ApiParam({ name: 'id', description: 'Resource ID' })
  @ApiResponse({ status: 200, description: 'Resource updated successfully' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  update(@Param('id') id: string, @Body() updateResourceDto: Partial<CreateResourceDto>) {
    return this.resourceService.update(+id, updateResourceDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resource' })
  @ApiParam({ name: 'id', description: 'Resource ID' })
  @ApiResponse({ status: 200, description: 'Resource deleted successfully' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  remove(@Param('id') id: string) {
    return this.resourceService.remove(+id);
  }
}
