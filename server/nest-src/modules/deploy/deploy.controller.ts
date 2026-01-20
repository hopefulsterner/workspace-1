import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DeployService } from './deploy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DeployProvider } from '@prisma/client';

@ApiTags('deploy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deploy')
export class DeployController {
  constructor(private readonly deployService: DeployService) {}

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get deployments for a project' })
  @ApiResponse({ status: 200, description: 'List of deployments' })
  async getDeployments(
    @Param('projectId') projectId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const deployments = await this.deployService.getDeployments(projectId, userId);
    return { deployments };
  }

  @Post('project/:projectId')
  @ApiOperation({ summary: 'Deploy a project' })
  @ApiResponse({ status: 201, description: 'Deployment started' })
  async deploy(
    @Param('projectId') projectId: string,
    @Body() body: { provider: DeployProvider; environment?: string },
    @CurrentUser('userId') userId: string,
  ) {
    const deployment = await this.deployService.deploy(projectId, userId, body);
    return { deployment };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deployment status' })
  @ApiResponse({ status: 200, description: 'Deployment details' })
  async getStatus(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    const deployment = await this.deployService.getDeploymentStatus(id, userId);
    return { deployment };
  }
}
