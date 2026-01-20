import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ExtensionsService } from './extensions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('extensions')
@Controller('extensions')
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List available extensions' })
  @ApiResponse({ status: 200, description: 'List of extensions' })
  async list(@Query() query: { category?: string; search?: string }) {
    const extensions = await this.extensionsService.listExtensions(query);
    return { extensions };
  }

  @Get('installed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List installed extensions' })
  @ApiResponse({ status: 200, description: 'List of installed extensions' })
  async listInstalled(@CurrentUser('userId') userId: string) {
    const extensions = await this.extensionsService.getUserExtensions(userId);
    return { extensions };
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get extension details' })
  @ApiResponse({ status: 200, description: 'Extension details' })
  async get(@Param('id') id: string) {
    const extension = await this.extensionsService.getExtension(id);
    return { extension };
  }

  @Post(':id/install')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Install an extension' })
  @ApiResponse({ status: 201, description: 'Extension installed' })
  async install(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.extensionsService.installExtension(userId, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Uninstall an extension' })
  @ApiResponse({ status: 200, description: 'Extension uninstalled' })
  async uninstall(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.extensionsService.uninstallExtension(userId, id);
  }
}
