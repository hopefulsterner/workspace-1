import { io, Socket } from 'socket.io-client';

// Socket.IO client service for real-time features
class SocketService {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  
  // Connection URL - use backend API URL
  private getSocketUrl(): string {
    // In production, connect to the API server
    // In development, use localhost:4000
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // Production: use api subdomain
      return 'https://api.maula.dev';
    }
    // Development
    return 'http://localhost:4000';
  }

  // Connect to Socket.IO server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        console.log('[Socket] Already connected');
        resolve();
        return;
      }

      const url = this.getSocketUrl();
      console.log('[Socket] Connecting to:', url);

      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected:', this.socket?.id);
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
        this.connected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Failed to connect to socket server'));
        }
      });

      // Re-register all existing listeners after reconnect
      this.socket.on('connect', () => {
        this.listeners.forEach((callbacks, event) => {
          callbacks.forEach(callback => {
            this.socket?.off(event, callback);
            this.socket?.on(event, callback);
          });
        });
      });
    });
  }

  // Disconnect from server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.listeners.clear();
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // Emit event to server
  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[Socket] Not connected, cannot emit:', event);
    }
  }

  // Listen for event from server
  on(event: string, callback: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  // Remove event listener
  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback);
    } else {
      this.listeners.delete(event);
      this.socket?.off(event);
    }
  }

  // One-time event listener
  once(event: string, callback: (...args: any[]) => void): void {
    this.socket?.once(event, callback);
  }

  // ===========================================
  // TERMINAL OPERATIONS
  // ===========================================
  
  // Create a new terminal session
  createTerminal(options?: { cols?: number; rows?: number }): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('terminal:create', options || { cols: 80, rows: 24 });
      
      this.socket.once('terminal:created', (data: { terminalId: string }) => {
        console.log('[Socket] Terminal created:', data.terminalId);
        resolve(data.terminalId);
      });

      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Terminal creation timeout')), 10000);
    });
  }

  // Send input to terminal
  sendTerminalInput(terminalId: string, input: string): void {
    this.emit('terminal:input', { terminalId, input });
  }

  // Resize terminal
  resizeTerminal(terminalId: string, cols: number, rows: number): void {
    this.emit('terminal:resize', { terminalId, cols, rows });
  }

  // Kill terminal
  killTerminal(terminalId: string): void {
    this.emit('terminal:kill', { terminalId });
  }

  // Listen for terminal output
  onTerminalOutput(callback: (data: { terminalId: string; data: string }) => void): void {
    this.on('terminal:output', callback);
  }

  // Listen for terminal exit
  onTerminalExit(callback: (data: { terminalId: string; exitCode: number }) => void): void {
    this.on('terminal:exit', callback);
  }

  // ===========================================
  // AI OPERATIONS
  // ===========================================
  
  // Stream AI chat response (with vision support)
  streamAIChat(
    messages: Array<{ role: string; content: string; images?: string[] }>,
    provider: string = 'openai',
    model?: string,
    callbacks?: {
      onChunk?: (content: string) => void;
      onDone?: () => void;
      onError?: (error: string) => void;
    }
  ): void {
    if (!this.socket?.connected) {
      callbacks?.onError?.('Socket not connected');
      return;
    }

    // Set up listeners
    const chunkHandler = (data: { content: string }) => {
      callbacks?.onChunk?.(data.content);
    };
    
    const doneHandler = () => {
      this.off('ai:chat:chunk', chunkHandler);
      this.off('ai:chat:done', doneHandler);
      this.off('ai:chat:error', errorHandler);
      callbacks?.onDone?.();
    };
    
    const errorHandler = (data: { error: string }) => {
      this.off('ai:chat:chunk', chunkHandler);
      this.off('ai:chat:done', doneHandler);
      this.off('ai:chat:error', errorHandler);
      callbacks?.onError?.(data.error);
    };

    this.on('ai:chat:chunk', chunkHandler);
    this.on('ai:chat:done', doneHandler);
    this.on('ai:chat:error', errorHandler);

    // Check if any messages have images - use vision model
    const hasImages = messages.some(m => m.images && m.images.length > 0);
    const visionModel = hasImages ? 'gpt-4o' : (model || 'gpt-4o-mini');

    // Send request
    this.emit('ai:chat:stream', {
      messages,
      provider,
      model: visionModel,
    });
  }

  // Request code completion
  requestCodeCompletion(
    prefix: string,
    suffix: string,
    language: string,
    callback: (completion: string) => void
  ): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Not connected for code completion');
      return;
    }

    this.socket.once('ai:complete:result', (data: { completion: string }) => {
      callback(data.completion);
    });

    this.emit('ai:complete', { prefix, suffix, language });
  }

  // ===========================================
  // MULTI-AGENT SYSTEM
  // ===========================================

  // Send message to specific agent or orchestrator
  sendAgentMessage(
    message: string,
    agentType?: string,
    projectContext?: string,
    callbacks?: {
      onStatus?: (status: { status: string; agent: string; message?: string }) => void;
      onResponse?: (response: string) => void;
      onError?: (error: string) => void;
    }
  ): void {
    if (!this.socket?.connected) {
      callbacks?.onError?.('Socket not connected');
      return;
    }

    // Set up listeners
    const statusHandler = (data: { status: string; agent: string; message?: string }) => {
      callbacks?.onStatus?.(data);
    };

    const responseHandler = (data: { response: string }) => {
      this.off('ai:agent:status', statusHandler);
      this.off('ai:agent:response', responseHandler);
      this.off('ai:agent:error', errorHandler);
      callbacks?.onResponse?.(data.response);
    };

    const errorHandler = (data: { error: string }) => {
      this.off('ai:agent:status', statusHandler);
      this.off('ai:agent:response', responseHandler);
      this.off('ai:agent:error', errorHandler);
      callbacks?.onError?.(data.error);
    };

    this.on('ai:agent:status', statusHandler);
    this.on('ai:agent:response', responseHandler);
    this.on('ai:agent:error', errorHandler);

    // Send request
    this.emit('ai:agent:chat', {
      message,
      agentType: agentType || 'orchestrator',
      projectContext,
    });
  }

  // Get list of available agents
  getAgentList(callback: (agents: Array<{ id: string; name: string; icon: string; description: string }>) => void): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Not connected for agent list');
      return;
    }

    this.socket.once('ai:agent:list', (data: { agents: Array<{ id: string; name: string; icon: string; description: string }> }) => {
      callback(data.agents);
    });

    this.emit('ai:agent:list');
  }

  // Clear agent history
  clearAgentHistory(callback?: () => void): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Not connected for clearing agent history');
      return;
    }

    if (callback) {
      this.socket.once('ai:agent:cleared', callback);
    }

    this.emit('ai:agent:clear');
  }
}

// Export singleton instance
export const socketService = new SocketService();

// Also export the class for testing
export { SocketService };
