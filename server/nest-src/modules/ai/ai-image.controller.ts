import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AIImageService } from './ai-image.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('ai')
@Controller('ai/image')
export class AIImageController {
  constructor(private readonly aiImageService: AIImageService) {}

  @Get('status')
  @Public()
  @ApiOperation({ summary: 'Check AI image generation status' })
  @ApiResponse({ status: 200, description: 'Service status' })
  getStatus() {
    return this.aiImageService.getStatus();
  }

  @Post('generate')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate an image from text prompt' })
  @ApiResponse({ status: 200, description: 'Generated image URLs' })
  async generateImage(@Body() body: {
    prompt: string;
    model?: string;
    size?: string;
    quality?: string;
    style?: string;
    n?: number;
  }) {
    return this.aiImageService.generateImage(body);
  }

  @Post('edit')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit an image with a mask' })
  @ApiResponse({ status: 200, description: 'Edited image URLs' })
  async editImage(@Body() body: {
    image: string;
    mask?: string;
    prompt: string;
    size?: string;
    n?: number;
  }) {
    return this.aiImageService.editImage(body);
  }

  @Post('variation')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create variations of an image' })
  @ApiResponse({ status: 200, description: 'Variation image URLs' })
  async createVariation(@Body() body: {
    image: string;
    n?: number;
    size?: string;
  }) {
    return this.aiImageService.createVariation(body);
  }
}
