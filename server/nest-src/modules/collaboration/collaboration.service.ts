import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../common/services/logger.service';
import { YjsService } from './yjs.service';
import { RedisService, RedisMessage } from './redis.service';
import { CrdtService } from './crdt.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CollaborationRoom {
  id: string;
  projectId: string;
  name: string;
  users: Map<string, CollaborationUser>;
  createdAt: Date;
}

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursor?: {
    filePath: string;
    line: number;
    column: number;
  };
  selection?: {
    filePath: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  lastActivity: Date;
}

export interface FileEditEvent {
  userId: string;
  filePath: string;
  operations: any[];
  timestamp: number;
}

@Injectable()
export class CollaborationService {
  private rooms: Map<string, CollaborationRoom> = new Map();
  private userRooms: Map<string, Set<string>> = new Map(); // userId -> roomIds

  // Predefined user colors for collaboration
  private readonly userColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#16A085',
  ];

  constructor(
    private readonly logger: LoggerService,
    private readonly yjsService: YjsService,
    private readonly redisService: RedisService,
    private readonly crdtService: CrdtService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext('CollaborationService');
    this.setupRedisSubscriptions();
  }

  private async setupRedisSubscriptions() {
    // Subscribe to collaboration events for cross-server sync
    await this.redisService.subscribe('collaboration:events', (message) => {
      this.handleRedisMessage(message);
    });
  }

  private handleRedisMessage(message: RedisMessage) {
    // Handle cross-server collaboration events
    switch (message.type) {
      case 'user:join':
        this.handleRemoteUserJoin(message);
        break;
      case 'user:leave':
        this.handleRemoteUserLeave(message);
        break;
      case 'cursor:update':
        this.handleRemoteCursorUpdate(message);
        break;
      case 'file:edit':
        this.handleRemoteFileEdit(message);
        break;
    }
  }

  // ============== Room Management ==============

  async createRoom(projectId: string, name?: string): Promise<CollaborationRoom> {
    const roomId = `project:${projectId}`;
    
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const room: CollaborationRoom = {
      id: roomId,
      projectId,
      name: name || `Project ${projectId}`,
      users: new Map(),
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    this.logger.log(`Created collaboration room: ${roomId}`);

    return room;
  }

  async joinRoom(
    roomId: string,
    userId: string,
    userName: string,
  ): Promise<{ room: CollaborationRoom; user: CollaborationUser }> {
    let room = this.rooms.get(roomId);
    
    if (!room) {
      // Create room if it doesn't exist
      const projectId = roomId.replace('project:', '');
      room = await this.createRoom(projectId);
    }

    // Assign a color to the user
    const colorIndex = room.users.size % this.userColors.length;
    const user: CollaborationUser = {
      id: userId,
      name: userName,
      color: this.userColors[colorIndex],
      lastActivity: new Date(),
    };

    room.users.set(userId, user);

    // Track user's rooms
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId)!.add(roomId);

    // Store in Redis for cross-server sync
    await this.redisService.addRoomMember(roomId, userId);
    await this.redisService.hSet(
      `room:${roomId}:users`,
      userId,
      JSON.stringify(user),
    );

    // Publish join event
    await this.redisService.publish('collaboration:events', {
      type: 'user:join',
      roomId,
      userId,
      data: user,
      timestamp: Date.now(),
    });

    this.logger.log(`User ${userName} (${userId}) joined room ${roomId}`);

    return { room, user };
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.users.delete(userId);

    // Update tracking
    const userRoomSet = this.userRooms.get(userId);
    if (userRoomSet) {
      userRoomSet.delete(roomId);
      if (userRoomSet.size === 0) {
        this.userRooms.delete(userId);
      }
    }

    // Update Redis
    await this.redisService.removeRoomMember(roomId, userId);
    await this.redisService.hDel(`room:${roomId}:users`, userId);
    await this.redisService.removeAwarenessState(roomId, userId);

    // Publish leave event
    await this.redisService.publish('collaboration:events', {
      type: 'user:leave',
      roomId,
      userId,
      data: null,
      timestamp: Date.now(),
    });

    this.logger.log(`User ${userId} left room ${roomId}`);

    // Clean up empty rooms
    if (room.users.size === 0) {
      setTimeout(() => {
        if (room.users.size === 0) {
          this.rooms.delete(roomId);
          this.logger.log(`Cleaned up empty room ${roomId}`);
        }
      }, 60000); // Wait 1 minute before cleanup
    }
  }

  async leaveAllRooms(userId: string): Promise<void> {
    const roomIds = this.userRooms.get(userId);
    if (!roomIds) return;

    for (const roomId of roomIds) {
      await this.leaveRoom(roomId, userId);
    }
  }

  getRoomUsers(roomId: string): CollaborationUser[] {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.users.values()) : [];
  }

  // ============== Document Collaboration ==============

  async openDocument(
    roomId: string,
    filePath: string,
    initialContent?: string,
  ): Promise<{ docId: string }> {
    const docId = filePath;
    const yjsDoc = await this.yjsService.getOrCreateDocument(roomId, docId);

    // If document is empty and we have initial content, set it
    const currentContent = this.yjsService.getTextContent(roomId, docId);
    if ((!currentContent || currentContent === '') && initialContent) {
      this.yjsService.setTextContent(roomId, docId, initialContent);
    }

    return { docId };
  }

  async closeDocument(roomId: string, docId: string, userId: string): Promise<void> {
    this.yjsService.removeClient(roomId, docId, userId);
  }

  getDocumentContent(roomId: string, docId: string): string | null {
    return this.yjsService.getTextContent(roomId, docId);
  }

  // ============== Cursor & Selection ==============

  async updateCursor(
    roomId: string,
    userId: string,
    cursor: {
      filePath: string;
      line: number;
      column: number;
    },
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const user = room.users.get(userId);
    if (user) {
      user.cursor = cursor;
      user.lastActivity = new Date();
    }

    // Store in Redis
    await this.redisService.storeAwarenessState(roomId, userId, { cursor });

    // Publish cursor update
    await this.redisService.publish('collaboration:events', {
      type: 'cursor:update',
      roomId,
      userId,
      data: cursor,
      timestamp: Date.now(),
    });
  }

  async updateSelection(
    roomId: string,
    userId: string,
    selection: {
      filePath: string;
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    },
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const user = room.users.get(userId);
    if (user) {
      user.selection = selection;
      user.lastActivity = new Date();
    }

    // Store in Redis
    await this.redisService.storeAwarenessState(roomId, userId, { selection });
  }

  // ============== File Operations ==============

  async handleFileEdit(
    roomId: string,
    userId: string,
    filePath: string,
    changes: any[],
  ): Promise<void> {
    const docId = filePath;
    
    // Convert to CRDT operations
    const operations = this.crdtService.monacoChangesToOperations(changes);

    // Apply to Yjs document
    const yjsDoc = await this.yjsService.getOrCreateDocument(roomId, docId);
    const yText = yjsDoc.doc.getText('content');
    this.crdtService.applyTextOperations(yText, operations);

    // Publish file edit event
    await this.redisService.publish('collaboration:events', {
      type: 'file:edit',
      roomId,
      userId,
      data: { filePath, operations },
      timestamp: Date.now(),
    });
  }

  // ============== Remote Event Handlers ==============

  private handleRemoteUserJoin(message: RedisMessage) {
    const room = this.rooms.get(message.roomId);
    if (room && !room.users.has(message.userId)) {
      room.users.set(message.userId, message.data);
    }
  }

  private handleRemoteUserLeave(message: RedisMessage) {
    const room = this.rooms.get(message.roomId);
    if (room) {
      room.users.delete(message.userId);
    }
  }

  private handleRemoteCursorUpdate(message: RedisMessage) {
    const room = this.rooms.get(message.roomId);
    if (room) {
      const user = room.users.get(message.userId);
      if (user) {
        user.cursor = message.data;
      }
    }
  }

  private handleRemoteFileEdit(message: RedisMessage) {
    // Yjs handles CRDT merge automatically via Redis pub/sub of updates
  }

  // ============== Utility ==============

  getActiveRooms(): CollaborationRoom[] {
    return Array.from(this.rooms.values());
  }

  getRoom(roomId: string): CollaborationRoom | undefined {
    return this.rooms.get(roomId);
  }

  getUserRooms(userId: string): string[] {
    const roomIds = this.userRooms.get(userId);
    return roomIds ? Array.from(roomIds) : [];
  }

  async getAwarenessStates(roomId: string): Promise<Map<string, any>> {
    return this.redisService.getAwarenessStates(roomId);
  }
}
