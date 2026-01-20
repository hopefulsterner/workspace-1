import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check media service status' })
  @ApiResponse({ status: 200, description: 'Service status' })
  getStatus() {
    return {
      configured: this.mediaService.isConfigured(),
    };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file' })
  @ApiResponse({ status: 201, description: 'File uploaded' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('userId') userId: string,
  ) {
    return this.mediaService.uploadFile(file, userId);
  }

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get a presigned upload URL' })
  @ApiResponse({ status: 200, description: 'Presigned URL' })
  async getPresignedUrl(
    @Body() body: { filename: string },
    @CurrentUser('userId') userId: string,
  ) {
    return this.mediaService.getSignedUploadUrl(body.filename, userId);
  }
}
