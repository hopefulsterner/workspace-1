import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get all files for a project' })
  @ApiResponse({ status: 200, description: 'List of files' })
  async findByProject(
    @Param('projectId') projectId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const files = await this.filesService.findByProject(projectId, userId);
    return { files };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single file' })
  @ApiResponse({ status: 200, description: 'File details' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    const file = await this.filesService.findOne(id, userId);
    return { file };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new file' })
  @ApiResponse({ status: 201, description: 'File created' })
  async create(
    @Body() dto: CreateFileDto,
    @CurrentUser('userId') userId: string,
  ) {
    const file = await this.filesService.create(userId, dto);
    return { file };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update file content' })
  @ApiResponse({ status: 200, description: 'File updated' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFileDto,
    @CurrentUser('userId') userId: string,
  ) {
    const file = await this.filesService.update(id, userId, dto);
    return { file };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.filesService.remove(id, userId);
  }

  @Patch(':id/rename')
  @ApiOperation({ summary: 'Rename a file' })
  @ApiResponse({ status: 200, description: 'File renamed' })
  async rename(
    @Param('id') id: string,
    @Body() body: { name: string; path: string },
    @CurrentUser('userId') userId: string,
  ) {
    const file = await this.filesService.rename(id, userId, body.name, body.path);
    return { file };
  }
}
