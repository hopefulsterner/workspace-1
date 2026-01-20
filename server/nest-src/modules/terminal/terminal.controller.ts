import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TerminalService } from './terminal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('terminal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('terminal')
export class TerminalController {
  constructor(private readonly terminalService: TerminalService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List terminal sessions' })
  @ApiResponse({ status: 200, description: 'List of session IDs' })
  listSessions(@CurrentUser('userId') userId: string) {
    return {
      sessions: this.terminalService.listSessions(userId),
      message: 'Connect via WebSocket for terminal access',
    };
  }

  @Get('info')
  @ApiOperation({ summary: 'Get terminal info' })
  @ApiResponse({ status: 200, description: 'Terminal information' })
  getInfo() {
    return {
      shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
      platform: process.platform,
      message: 'Connect via WebSocket for interactive terminal',
    };
  }
}
