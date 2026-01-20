import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LoggerService } from '../../common/services/logger.service';
import { TerminalService } from '../terminal/terminal.service';
import { AIService } from '../ai/ai.service';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://maula.dev',
      'https://app.maula.dev',
      'https://www.maula.dev',
    ],
    methods: ['GET', 'POST'],
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientTerminals: Map<string, string[]> = new Map();

  constructor(
    private readonly logger: LoggerService,
    private readonly terminalService: TerminalService,
    private readonly aiService: AIService,
  ) {
    this.logger.setContext('WebSocket');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.clientTerminals.set(client.id, []);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Clean up terminal sessions for this client
    const terminals = this.clientTerminals.get(client.id) || [];
    for (const terminalId of terminals) {
      this.terminalService.destroySession(terminalId);
    }
    this.clientTerminals.delete(client.id);
  }

  // ============== TERMINAL EVENTS ==============

  @SubscribeMessage('terminal:create')
  handleTerminalCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cols?: number; rows?: number },
  ) {
    const terminalId = this.terminalService.createSession(client.id, data);
    
    // Track terminal for cleanup
    const terminals = this.clientTerminals.get(client.id) || [];
    terminals.push(terminalId);
    this.clientTerminals.set(client.id, terminals);

    // Set up data listener
    this.terminalService.onData(terminalId, (output) => {
      client.emit('terminal:data', { terminalId, data: output });
    });

    // Set up exit listener
    this.terminalService.onExit(terminalId, (exitCode) => {
      client.emit('terminal:exit', { terminalId, exitCode });
    });

    client.emit('terminal:created', { terminalId });
    this.logger.log(`Terminal created: ${terminalId}`);

    return { terminalId };
  }

  @SubscribeMessage('terminal:input')
  handleTerminalInput(
    @MessageBody() data: { terminalId: string; data: string },
  ) {
    this.terminalService.write(data.terminalId, data.data);
  }

  @SubscribeMessage('terminal:resize')
  handleTerminalResize(
    @MessageBody() data: { terminalId: string; cols: number; rows: number },
  ) {
    this.terminalService.resize(data.terminalId, data.cols, data.rows);
  }

  @SubscribeMessage('terminal:destroy')
  handleTerminalDestroy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { terminalId: string },
  ) {
    this.terminalService.destroySession(data.terminalId);
    
    // Remove from tracking
    const terminals = this.clientTerminals.get(client.id) || [];
    const index = terminals.indexOf(data.terminalId);
    if (index > -1) {
      terminals.splice(index, 1);
    }

    client.emit('terminal:destroyed', { terminalId: data.terminalId });
  }

  // ============== AI STREAMING EVENTS ==============

  @SubscribeMessage('ai:chat')
  async handleAIChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      messages: Array<{ role: string; content: string }>;
      provider?: string;
      model?: string;
      stream?: boolean;
    },
  ) {
    try {
      if (data.stream !== false) {
        // Streaming response
        for await (const chunk of this.aiService.streamChat({
          messages: data.messages as any,
          provider: data.provider,
          model: data.model,
        })) {
          client.emit('ai:chunk', { content: chunk });
        }
        client.emit('ai:done', {});
      } else {
        // Non-streaming response
        const response = await this.aiService.chat({
          messages: data.messages as any,
          provider: data.provider,
          model: data.model,
        });
        client.emit('ai:response', { content: response });
      }
    } catch (error) {
      client.emit('ai:error', { error: (error as Error).message });
    }
  }

  @SubscribeMessage('ai:cancel')
  handleAICancel(@ConnectedSocket() client: Socket) {
    // Note: Actual cancellation would require tracking active requests
    client.emit('ai:cancelled', {});
  }

  // ============== COLLABORATION EVENTS ==============

  @SubscribeMessage('room:join')
  handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId?: string },
  ) {
    client.join(data.roomId);
    client.to(data.roomId).emit('room:user-joined', {
      userId: data.userId || client.id,
    });
    this.logger.log(`Client ${client.id} joined room ${data.roomId}`);
  }

  @SubscribeMessage('room:leave')
  handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    client.leave(data.roomId);
    client.to(data.roomId).emit('room:user-left', { userId: client.id });
  }

  @SubscribeMessage('room:broadcast')
  handleRoomBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; event: string; payload: any },
  ) {
    client.to(data.roomId).emit(data.event, data.payload);
  }

  // ============== FILE SYNC EVENTS ==============

  @SubscribeMessage('file:change')
  handleFileChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      filePath: string;
      content: string;
      cursorPosition?: { line: number; column: number };
    },
  ) {
    client.to(data.roomId).emit('file:changed', {
      userId: client.id,
      filePath: data.filePath,
      content: data.content,
      cursorPosition: data.cursorPosition,
    });
  }

  @SubscribeMessage('cursor:move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      filePath: string;
      position: { line: number; column: number };
    },
  ) {
    client.to(data.roomId).emit('cursor:moved', {
      userId: client.id,
      filePath: data.filePath,
      position: data.position,
    });
  }
}
