import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { LoggerService } from '../../common/services/logger.service';

export interface RedisMessage {
  type: string;
  roomId: string;
  userId: string;
  data: any;
  timestamp: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private publisher: RedisClientType | null = null;
  private isConnected = false;
  private subscriptions: Map<string, Set<(message: RedisMessage) => void>> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('RedisService');
  }

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    // Skip Redis initialization if no URL is provided
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured - collaboration will work in single-server mode');
      return;
    }
    
    try {
      const clientOptions = {
        url: redisUrl,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries: number) => {
            if (retries > 3) {
              this.logger.warn('Redis connection failed after 3 retries - continuing without Redis');
              return false; // Stop reconnecting
            }
            return Math.min(retries * 100, 1000);
          },
        },
      };
      
      // Main client for general operations
      this.client = createClient(clientOptions);
      this.client.on('error', (err) => this.logger.error('Redis client error', err.message));
      this.client.on('connect', () => this.logger.log('Redis client connected'));
      
      // Publisher for pub/sub
      this.publisher = createClient(clientOptions);
      this.publisher.on('error', (err) => this.logger.error('Redis publisher error', err.message));
      
      // Subscriber for pub/sub
      this.subscriber = createClient(clientOptions);
      this.subscriber.on('error', (err) => this.logger.error('Redis subscriber error', err.message));
      
      await Promise.all([
        this.client.connect(),
        this.publisher.connect(),
        this.subscriber.connect(),
      ]);
      
      this.isConnected = true;
      this.logger.log('Redis connections established');
    } catch (error) {
      this.logger.warn('Failed to connect to Redis - continuing without Redis: ' + (error as Error).message);
      // Continue without Redis - will use in-memory fallback
      this.client = null;
      this.publisher = null;
      this.subscriber = null;
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await Promise.all([
        this.client?.quit(),
        this.publisher?.quit(),
        this.subscriber?.quit(),
      ]);
      this.logger.log('Redis connections closed');
    }
  }

  // ============== Basic Operations ==============

  async get(key: string): Promise<string | null> {
    if (!this.isConnected || !this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected || !this.client) return;
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    return (await this.client.exists(key)) > 0;
  }

  // ============== Hash Operations (for room/user state) ==============

  async hSet(key: string, field: string, value: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    await this.client.hSet(key, field, value);
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    if (!this.isConnected || !this.client) return undefined;
    return this.client.hGet(key, field);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    if (!this.isConnected || !this.client) return {};
    return this.client.hGetAll(key);
  }

  async hDel(key: string, field: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    await this.client.hDel(key, field);
  }

  // ============== Set Operations (for room members) ==============

  async sAdd(key: string, member: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    await this.client.sAdd(key, member);
  }

  async sRem(key: string, member: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    await this.client.sRem(key, member);
  }

  async sMembers(key: string): Promise<string[]> {
    if (!this.isConnected || !this.client) return [];
    return this.client.sMembers(key);
  }

  async sIsMember(key: string, member: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    return this.client.sIsMember(key, member);
  }

  // ============== Pub/Sub for Real-Time Sync ==============

  async publish(channel: string, message: RedisMessage): Promise<void> {
    if (!this.isConnected || !this.publisher) return;
    await this.publisher.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: RedisMessage) => void): Promise<void> {
    if (!this.isConnected || !this.subscriber) {
      // Store for in-memory fallback
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add(callback);
      return;
    }

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel, (messageStr) => {
        try {
          const message = JSON.parse(messageStr) as RedisMessage;
          const callbacks = this.subscriptions.get(channel);
          if (callbacks) {
            callbacks.forEach(cb => cb(message));
          }
        } catch (error) {
          this.logger.error(`Error parsing message from channel ${channel}`, (error as Error).message);
        }
      });
    }
    
    this.subscriptions.get(channel)!.add(callback);
  }

  async unsubscribe(channel: string, callback?: (message: RedisMessage) => void): Promise<void> {
    if (callback) {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
          if (this.isConnected) {
            await this.subscriber.unsubscribe(channel);
          }
        }
      }
    } else {
      this.subscriptions.delete(channel);
      if (this.isConnected) {
        await this.subscriber.unsubscribe(channel);
      }
    }
  }

  // ============== Collaboration-Specific Methods ==============

  // Store document state
  async storeDocumentState(roomId: string, docId: string, state: Uint8Array): Promise<void> {
    const key = `collab:doc:${roomId}:${docId}`;
    await this.set(key, Buffer.from(state).toString('base64'), 86400); // 24h TTL
  }

  async getDocumentState(roomId: string, docId: string): Promise<Uint8Array | null> {
    const key = `collab:doc:${roomId}:${docId}`;
    const data = await this.get(key);
    if (!data) return null;
    return Buffer.from(data, 'base64');
  }

  // Store awareness state (cursors, selections, etc.)
  async storeAwarenessState(roomId: string, clientId: string, state: any): Promise<void> {
    const key = `collab:awareness:${roomId}`;
    await this.hSet(key, clientId, JSON.stringify(state));
  }

  async getAwarenessStates(roomId: string): Promise<Map<string, any>> {
    const key = `collab:awareness:${roomId}`;
    const data = await this.hGetAll(key);
    const result = new Map<string, any>();
    for (const [clientId, stateStr] of Object.entries(data)) {
      try {
        result.set(clientId, JSON.parse(stateStr));
      } catch {}
    }
    return result;
  }

  async removeAwarenessState(roomId: string, clientId: string): Promise<void> {
    const key = `collab:awareness:${roomId}`;
    await this.hDel(key, clientId);
  }

  // Room management
  async addRoomMember(roomId: string, userId: string): Promise<void> {
    await this.sAdd(`collab:room:${roomId}:members`, userId);
  }

  async removeRoomMember(roomId: string, userId: string): Promise<void> {
    await this.sRem(`collab:room:${roomId}:members`, userId);
  }

  async getRoomMembers(roomId: string): Promise<string[]> {
    return this.sMembers(`collab:room:${roomId}:members`);
  }

  get connected(): boolean {
    return this.isConnected;
  }
}
