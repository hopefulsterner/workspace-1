import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { LoggerService } from '../../common/services/logger.service';
import { RedisService } from './redis.service';

// Message types for Yjs protocol
export const messageSync = 0;
export const messageAwareness = 1;
export const messageAuth = 2;
export const messageQueryAwareness = 3;

export interface YjsDocument {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<string>;
}

export interface AwarenessState {
  user?: {
    name: string;
    color: string;
  };
  cursor?: {
    anchor: any;
    head: any;
  };
  selection?: any;
}

@Injectable()
export class YjsService implements OnModuleDestroy {
  private documents: Map<string, YjsDocument> = new Map();
  private persistenceInterval: NodeJS.Timeout;

  constructor(
    private readonly logger: LoggerService,
    private readonly redisService: RedisService,
  ) {
    this.logger.setContext('YjsService');
    
    // Periodically persist documents to Redis
    this.persistenceInterval = setInterval(() => this.persistAllDocuments(), 30000);
  }

  onModuleDestroy() {
    clearInterval(this.persistenceInterval);
    // Persist all documents before shutdown
    this.persistAllDocuments();
  }

  // ============== Document Management ==============

  async getOrCreateDocument(roomId: string, docId: string): Promise<YjsDocument> {
    const key = `${roomId}:${docId}`;
    
    if (this.documents.has(key)) {
      return this.documents.get(key)!;
    }

    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);

    // Try to load from Redis
    const savedState = await this.redisService.getDocumentState(roomId, docId);
    if (savedState) {
      try {
        Y.applyUpdate(doc, savedState);
        this.logger.log(`Loaded document ${key} from Redis`);
      } catch (error) {
        this.logger.error(`Failed to load document ${key}`, (error as Error).message);
      }
    }

    const yjsDoc: YjsDocument = {
      doc,
      awareness,
      clients: new Set(),
    };

    // Listen for document updates
    doc.on('update', (update: Uint8Array, origin: any) => {
      // Persist on significant changes
      this.scheduleDocumentPersistence(roomId, docId, doc);
    });

    // Listen for awareness updates
    awareness.on('update', ({ added, updated, removed }: any) => {
      // Handle awareness changes (cursors, selections)
      const changedClients = [...added, ...updated, ...removed];
      this.broadcastAwarenessUpdate(roomId, docId, awareness, changedClients);
    });

    this.documents.set(key, yjsDoc);
    this.logger.log(`Created document ${key}`);

    return yjsDoc;
  }

  // ============== Client Management ==============

  addClient(roomId: string, docId: string, clientId: string): void {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (yjsDoc) {
      yjsDoc.clients.add(clientId);
      this.logger.log(`Client ${clientId} joined document ${key}`);
    }
  }

  removeClient(roomId: string, docId: string, clientId: string): void {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (yjsDoc) {
      yjsDoc.clients.delete(clientId);
      
      // Remove awareness state for this client
      awarenessProtocol.removeAwarenessStates(
        yjsDoc.awareness,
        [yjsDoc.awareness.clientID],
        null,
      );

      // Clean up document if no clients
      if (yjsDoc.clients.size === 0) {
        this.scheduleDocumentCleanup(roomId, docId);
      }

      this.logger.log(`Client ${clientId} left document ${key}`);
    }
  }

  // ============== Sync Protocol ==============

  /**
   * Process a sync message from a client
   * Returns an array of messages to send back
   */
  processSyncMessage(
    roomId: string,
    docId: string,
    message: Uint8Array,
  ): Uint8Array[] {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (!yjsDoc) return [];

    const decoder = decoding.createDecoder(message);
    const encoder = encoding.createEncoder();
    const messageType = decoding.readVarUint(decoder);
    const responses: Uint8Array[] = [];

    switch (messageType) {
      case messageSync: {
        const syncMessageType = decoding.readVarUint(decoder);
        
        switch (syncMessageType) {
          case syncProtocol.messageYjsSyncStep1: {
            // Client sends state vector, we respond with missing updates
            encoding.writeVarUint(encoder, messageSync);
            const sv = decoding.readVarUint8Array(decoder);
            syncProtocol.writeSyncStep2(encoder, yjsDoc.doc, sv);
            responses.push(encoding.toUint8Array(encoder));
            break;
          }
          case syncProtocol.messageYjsSyncStep2: {
            // Client sends updates
            const update = decoding.readVarUint8Array(decoder);
            Y.applyUpdate(yjsDoc.doc, update);
            break;
          }
          case syncProtocol.messageYjsUpdate: {
            // Incremental update
            const update = decoding.readVarUint8Array(decoder);
            Y.applyUpdate(yjsDoc.doc, update);
            break;
          }
        }
        break;
      }
      case messageAwareness: {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(yjsDoc.awareness, update, null);
        break;
      }
      case messageQueryAwareness: {
        // Client requests awareness states
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(
            yjsDoc.awareness,
            Array.from(yjsDoc.awareness.getStates().keys()),
          ),
        );
        responses.push(encoding.toUint8Array(encoder));
        break;
      }
    }

    return responses;
  }

  /**
   * Create initial sync message (step 1)
   */
  createSyncStep1(roomId: string, docId: string): Uint8Array {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (!yjsDoc) {
      // Return empty sync message
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, new Y.Doc());
      return encoding.toUint8Array(encoder);
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, yjsDoc.doc);
    return encoding.toUint8Array(encoder);
  }

  /**
   * Create awareness update message
   */
  createAwarenessUpdate(roomId: string, docId: string, clientIds?: number[]): Uint8Array | null {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (!yjsDoc) return null;

    const clients = clientIds || Array.from(yjsDoc.awareness.getStates().keys());
    if (clients.length === 0) return null;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(yjsDoc.awareness, clients),
    );
    return encoding.toUint8Array(encoder);
  }

  // ============== Document Operations ==============

  /**
   * Apply an update to the document
   */
  applyUpdate(roomId: string, docId: string, update: Uint8Array, origin?: any): void {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (yjsDoc) {
      Y.applyUpdate(yjsDoc.doc, update, origin);
    }
  }

  /**
   * Get current document state as update
   */
  getDocumentState(roomId: string, docId: string): Uint8Array | null {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (!yjsDoc) return null;
    return Y.encodeStateAsUpdate(yjsDoc.doc);
  }

  /**
   * Get the document's text content
   */
  getTextContent(roomId: string, docId: string, type: string = 'content'): string | null {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (!yjsDoc) return null;
    
    const yText = yjsDoc.doc.getText(type);
    return yText.toString();
  }

  /**
   * Set the document's text content (for initialization)
   */
  setTextContent(roomId: string, docId: string, content: string, type: string = 'content'): void {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (yjsDoc) {
      const yText = yjsDoc.doc.getText(type);
      yjsDoc.doc.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, content);
      });
    }
  }

  // ============== Awareness Management ==============

  setAwarenessState(roomId: string, docId: string, state: AwarenessState): void {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (yjsDoc) {
      yjsDoc.awareness.setLocalState(state);
    }
  }

  getAwarenessStates(roomId: string, docId: string): Map<number, any> | null {
    const key = `${roomId}:${docId}`;
    const yjsDoc = this.documents.get(key);
    if (!yjsDoc) return null;
    return yjsDoc.awareness.getStates();
  }

  // ============== Persistence ==============

  private persistenceScheduled: Set<string> = new Set();

  private scheduleDocumentPersistence(roomId: string, docId: string, doc: Y.Doc): void {
    const key = `${roomId}:${docId}`;
    if (!this.persistenceScheduled.has(key)) {
      this.persistenceScheduled.add(key);
      setTimeout(async () => {
        try {
          const state = Y.encodeStateAsUpdate(doc);
          await this.redisService.storeDocumentState(roomId, docId, state);
          this.logger.debug(`Persisted document ${key}`);
        } catch (error) {
          this.logger.error(`Failed to persist document ${key}`, (error as Error).message);
        } finally {
          this.persistenceScheduled.delete(key);
        }
      }, 5000); // Debounce for 5 seconds
    }
  }

  private async persistAllDocuments(): Promise<void> {
    for (const [key, yjsDoc] of this.documents) {
      const [roomId, docId] = key.split(':');
      try {
        const state = Y.encodeStateAsUpdate(yjsDoc.doc);
        await this.redisService.storeDocumentState(roomId, docId, state);
      } catch (error) {
        this.logger.error(`Failed to persist document ${key}`, (error as Error).message);
      }
    }
  }

  // ============== Cleanup ==============

  private cleanupScheduled: Set<string> = new Set();

  private scheduleDocumentCleanup(roomId: string, docId: string): void {
    const key = `${roomId}:${docId}`;
    if (!this.cleanupScheduled.has(key)) {
      this.cleanupScheduled.add(key);
      setTimeout(async () => {
        const yjsDoc = this.documents.get(key);
        if (yjsDoc && yjsDoc.clients.size === 0) {
          // Persist before cleanup
          try {
            const state = Y.encodeStateAsUpdate(yjsDoc.doc);
            await this.redisService.storeDocumentState(roomId, docId, state);
          } catch {}
          
          // Destroy the document
          yjsDoc.doc.destroy();
          this.documents.delete(key);
          this.logger.log(`Cleaned up document ${key}`);
        }
        this.cleanupScheduled.delete(key);
      }, 30000); // Wait 30 seconds before cleanup
    }
  }

  private broadcastAwarenessUpdate(
    roomId: string,
    docId: string,
    awareness: awarenessProtocol.Awareness,
    changedClients: number[],
  ): void {
    // This will be called by the gateway to broadcast to other clients
    // The actual broadcast is handled in CollaborationGateway
  }

  // ============== Utility ==============

  getDocument(roomId: string, docId: string): YjsDocument | undefined {
    return this.documents.get(`${roomId}:${docId}`);
  }

  getActiveDocuments(): string[] {
    return Array.from(this.documents.keys());
  }

  getClientCount(roomId: string, docId: string): number {
    const yjsDoc = this.documents.get(`${roomId}:${docId}`);
    return yjsDoc ? yjsDoc.clients.size : 0;
  }
}
