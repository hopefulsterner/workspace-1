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
import { CollaborationService } from './collaboration.service';
import { YjsService, messageSync, messageAwareness } from './yjs.service';
import { CrdtService } from './crdt.service';
import { RedisService } from './redis.service';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

interface ClientState {
  userId?: string;
  userName?: string;
  rooms: Set<string>;
  documents: Set<string>;
}

@WebSocketGateway({
  namespace: '/collaboration',
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
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clients: Map<string, ClientState> = new Map();

  constructor(
    private readonly logger: LoggerService,
    private readonly collaborationService: CollaborationService,
    private readonly yjsService: YjsService,
    private readonly crdtService: CrdtService,
    private readonly redisService: RedisService,
  ) {
    this.logger.setContext('CollaborationGateway');
    this.setupRedisBroadcast();
  }

  private async setupRedisBroadcast() {
    // Listen for Redis events to broadcast to local clients
    await this.redisService.subscribe('collaboration:broadcast', (message) => {
      const { roomId, event, data, excludeClient } = message.data;
      this.broadcastToRoom(roomId, event, data, excludeClient);
    });
  }

  handleConnection(client: Socket) {
    this.clients.set(client.id, {
      rooms: new Set(),
      documents: new Set(),
    });
    this.logger.log(`Collaboration client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const state = this.clients.get(client.id);
    
    if (state) {
      // Leave all rooms
      for (const roomId of state.rooms) {
        if (state.userId) {
          await this.collaborationService.leaveRoom(roomId, state.userId);
        }
        client.leave(roomId);
      }

      // Close all documents
      for (const docKey of state.documents) {
        const [roomId, docId] = docKey.split('::');
        this.yjsService.removeClient(roomId, docId, client.id);
      }
    }

    this.clients.delete(client.id);
    this.logger.log(`Collaboration client disconnected: ${client.id}`);
  }

  // ============== Authentication ==============

  @SubscribeMessage('auth')
  handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; userName: string },
  ) {
    const state = this.clients.get(client.id);
    if (state) {
      state.userId = data.userId;
      state.userName = data.userName;
    }
    
    client.emit('auth:success', { userId: data.userId });
    this.logger.log(`Client ${client.id} authenticated as ${data.userName}`);
  }

  // ============== Room Management ==============

  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; projectId?: string },
  ) {
    const state = this.clients.get(client.id);
    if (!state?.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const roomId = data.roomId || `project:${data.projectId}`;
    
    try {
      const { room, user } = await this.collaborationService.joinRoom(
        roomId,
        state.userId,
        state.userName || 'Anonymous',
      );

      // Join Socket.IO room
      client.join(roomId);
      state.rooms.add(roomId);

      // Get current users
      const users = this.collaborationService.getRoomUsers(roomId);

      // Notify client
      client.emit('room:joined', {
        roomId,
        user,
        users,
      });

      // Notify others in room
      client.to(roomId).emit('room:user-joined', { user });

      this.logger.log(`User ${state.userName} joined room ${roomId}`);
    } catch (error) {
      client.emit('error', { message: (error as Error).message });
    }
  }

  @SubscribeMessage('room:leave')
  async handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const state = this.clients.get(client.id);
    if (!state?.userId) return;

    await this.collaborationService.leaveRoom(data.roomId, state.userId);
    
    client.leave(data.roomId);
    state.rooms.delete(data.roomId);

    // Notify others
    client.to(data.roomId).emit('room:user-left', {
      userId: state.userId,
    });

    client.emit('room:left', { roomId: data.roomId });
  }

  @SubscribeMessage('room:users')
  handleRoomUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const users = this.collaborationService.getRoomUsers(data.roomId);
    client.emit('room:users', { roomId: data.roomId, users });
  }

  // ============== Document Synchronization (Yjs) ==============

  @SubscribeMessage('doc:open')
  async handleDocOpen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; filePath: string; content?: string },
  ) {
    const state = this.clients.get(client.id);
    if (!state?.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { roomId, filePath, content } = data;
    const docKey = `${roomId}::${filePath}`;

    try {
      // Open/create document
      await this.collaborationService.openDocument(roomId, filePath, content);
      
      // Register client with Yjs
      this.yjsService.addClient(roomId, filePath, client.id);
      state.documents.add(docKey);

      // Join document-specific room
      client.join(docKey);

      // Send initial sync message
      const syncStep1 = this.yjsService.createSyncStep1(roomId, filePath);
      client.emit('doc:sync', {
        roomId,
        filePath,
        message: Array.from(syncStep1),
      });

      // Send current awareness states
      const awarenessUpdate = this.yjsService.createAwarenessUpdate(roomId, filePath);
      if (awarenessUpdate) {
        client.emit('doc:awareness', {
          roomId,
          filePath,
          message: Array.from(awarenessUpdate),
        });
      }

      client.emit('doc:opened', { roomId, filePath });
      this.logger.log(`Client ${client.id} opened document ${filePath}`);
    } catch (error) {
      client.emit('error', { message: (error as Error).message });
    }
  }

  @SubscribeMessage('doc:close')
  handleDocClose(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; filePath: string },
  ) {
    const state = this.clients.get(client.id);
    if (!state) return;

    const { roomId, filePath } = data;
    const docKey = `${roomId}::${filePath}`;

    this.yjsService.removeClient(roomId, filePath, client.id);
    state.documents.delete(docKey);
    client.leave(docKey);

    client.emit('doc:closed', { roomId, filePath });
  }

  @SubscribeMessage('doc:update')
  handleDocUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; filePath: string; message: number[] },
  ) {
    const { roomId, filePath, message } = data;
    const update = new Uint8Array(message);
    const docKey = `${roomId}::${filePath}`;

    // Process sync message
    const responses = this.yjsService.processSyncMessage(roomId, filePath, update);

    // Send responses back to client
    for (const response of responses) {
      client.emit('doc:sync', {
        roomId,
        filePath,
        message: Array.from(response),
      });
    }

    // Broadcast to other clients in document room
    client.to(docKey).emit('doc:update', {
      roomId,
      filePath,
      message,
    });
  }

  @SubscribeMessage('doc:awareness')
  handleDocAwareness(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; filePath: string; message: number[] },
  ) {
    const { roomId, filePath, message } = data;
    const docKey = `${roomId}::${filePath}`;

    // Process awareness update
    const update = new Uint8Array(message);
    this.yjsService.processSyncMessage(roomId, filePath, update);

    // Broadcast to other clients
    client.to(docKey).emit('doc:awareness', {
      roomId,
      filePath,
      message,
    });
  }

  // ============== Cursor & Selection ==============

  @SubscribeMessage('cursor:update')
  async handleCursorUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      filePath: string;
      line: number;
      column: number;
    },
  ) {
    const state = this.clients.get(client.id);
    if (!state?.userId) return;

    const { roomId, filePath, line, column } = data;

    await this.collaborationService.updateCursor(roomId, state.userId, {
      filePath,
      line,
      column,
    });

    // Broadcast to room
    client.to(roomId).emit('cursor:updated', {
      userId: state.userId,
      userName: state.userName,
      filePath,
      line,
      column,
    });
  }

  @SubscribeMessage('selection:update')
  async handleSelectionUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      filePath: string;
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    },
  ) {
    const state = this.clients.get(client.id);
    if (!state?.userId) return;

    const { roomId, filePath, startLine, startColumn, endLine, endColumn } = data;

    await this.collaborationService.updateSelection(roomId, state.userId, {
      filePath,
      startLine,
      startColumn,
      endLine,
      endColumn,
    });

    // Broadcast to room
    client.to(roomId).emit('selection:updated', {
      userId: state.userId,
      userName: state.userName,
      filePath,
      startLine,
      startColumn,
      endLine,
      endColumn,
    });
  }

  // ============== File Operations (Monaco-style) ==============

  @SubscribeMessage('file:changes')
  async handleFileChanges(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      roomId: string;
      filePath: string;
      changes: any[];
      versionId?: number;
    },
  ) {
    const state = this.clients.get(client.id);
    if (!state?.userId) return;

    const { roomId, filePath, changes } = data;

    // Process changes through CRDT
    await this.collaborationService.handleFileEdit(
      roomId,
      state.userId,
      filePath,
      changes,
    );

    // Broadcast to other clients
    const docKey = `${roomId}::${filePath}`;
    client.to(docKey).emit('file:changes', {
      userId: state.userId,
      filePath,
      changes,
    });
  }

  // ============== Utility ==============

  private broadcastToRoom(
    roomId: string,
    event: string,
    data: any,
    excludeClientId?: string,
  ) {
    if (excludeClientId) {
      this.server.to(roomId).except(excludeClientId).emit(event, data);
    } else {
      this.server.to(roomId).emit(event, data);
    }
  }
}
