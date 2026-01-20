import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { AIService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('ai')
@Controller('ai')
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Get('providers')
  @Public()
  @ApiOperation({ summary: 'Get available AI providers' })
  @ApiResponse({ status: 200, description: 'List of available providers' })
  getProviders() {
    return {
      providers: this.aiService.getAvailableProviders(),
    };
  }

  @Post('chat')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a chat message (non-streaming)' })
  @ApiResponse({ status: 200, description: 'AI response' })
  async chat(@Body() dto: ChatDto) {
    const response = await this.aiService.chat(dto);
    return { response };
  }

  @Post('chat/stream')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a chat message (streaming)' })
  @ApiResponse({ status: 200, description: 'Streamed AI response' })
  async streamChat(@Body() dto: ChatDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of this.aiService.streamChat(dto)) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`);
    } finally {
      res.end();
    }
  }
}
