import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { TerminalModule } from '../terminal/terminal.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [TerminalModule, AIModule],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class WebSocketModule {}
