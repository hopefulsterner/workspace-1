import { socketService } from './socket';
import { ChatMessage } from '../types';

// AI Agent Service - Real-time streaming with file operations
export interface AIAgentCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
  onFileOperation?: (operation: FileOperation) => void;
  onTerminalCommand?: (command: string, output: string) => void;
}

export interface FileOperation {
  type: 'create' | 'edit' | 'delete' | 'read';
  path: string;
  content?: string;
  oldContent?: string;
}

export interface AIAgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];  // Base64 data URLs for images
}

// System prompt for agentic AI assistant
const AGENTIC_SYSTEM_PROMPT = `You are an expert AI coding assistant in the "AI Digital Friend Zone" IDE with FULL access to modify files, run terminal commands, and build applications.

## Your Capabilities:
1. **Create Files**: You can create new files with complete code
2. **Edit Files**: You can modify existing files  
3. **Delete Files**: You can remove files when needed
4. **Run Commands**: You can execute terminal commands
5. **Build Projects**: You can scaffold entire applications

## Response Format:
When you need to perform file operations, use these XML tags:

### Create a file:
<file_create path="path/to/file.ts">
file content here
</file_create>

### Edit a file (provide full new content):
<file_edit path="path/to/file.ts">
complete new file content
</file_edit>

### Delete a file:
<file_delete path="path/to/file.ts" />

### Run a terminal command:
<terminal_run>
npm install express
</terminal_run>

## Guidelines:
- Always provide COMPLETE, working code - never use placeholders like "..."
- Include all necessary imports
- Follow best practices for the language/framework
- Add helpful comments when appropriate
- When creating multi-file projects, create files in logical order (config first, then main files)
- Test commands should be provided when applicable

When the user asks to build something, break it down and create ALL necessary files.`;

class AIAgentService {
  private isStreaming: boolean = false;
  private currentResponse: string = '';
  
  // Parse AI response for file operations
  parseOperations(response: string): FileOperation[] {
    const operations: FileOperation[] = [];
    
    // Parse file_create tags
    const createRegex = /<file_create\s+path="([^"]+)">([\s\S]*?)<\/file_create>/g;
    let match;
    while ((match = createRegex.exec(response)) !== null) {
      operations.push({
        type: 'create',
        path: match[1],
        content: match[2].trim(),
      });
    }
    
    // Parse file_edit tags
    const editRegex = /<file_edit\s+path="([^"]+)">([\s\S]*?)<\/file_edit>/g;
    while ((match = editRegex.exec(response)) !== null) {
      operations.push({
        type: 'edit',
        path: match[1],
        content: match[2].trim(),
      });
    }
    
    // Parse file_delete tags
    const deleteRegex = /<file_delete\s+path="([^"]+)"\s*\/>/g;
    while ((match = deleteRegex.exec(response)) !== null) {
      operations.push({
        type: 'delete',
        path: match[1],
      });
    }
    
    return operations;
  }
  
  // Parse terminal commands from response
  parseTerminalCommands(response: string): string[] {
    const commands: string[] = [];
    const terminalRegex = /<terminal_run>([\s\S]*?)<\/terminal_run>/g;
    let match;
    while ((match = terminalRegex.exec(response)) !== null) {
      commands.push(match[1].trim());
    }
    return commands;
  }
  
  // Clean response by removing operation tags for display
  cleanResponse(response: string): string {
    return response
      .replace(/<file_create\s+path="[^"]+">[\s\S]*?<\/file_create>/g, '')
      .replace(/<file_edit\s+path="[^"]+">[\s\S]*?<\/file_edit>/g, '')
      .replace(/<file_delete\s+path="[^"]+"\s*\/>/g, '')
      .replace(/<terminal_run>[\s\S]*?<\/terminal_run>/g, '')
      .trim();
  }
  
  // Stream chat via WebSocket
  async streamChat(
    messages: AIAgentMessage[],
    callbacks: AIAgentCallbacks,
    provider: string = 'openai',
    model: string = 'gpt-4o-mini'
  ): Promise<void> {
    if (this.isStreaming) {
      callbacks.onError(new Error('Already streaming'));
      return;
    }
    
    this.isStreaming = true;
    this.currentResponse = '';
    
    // Ensure socket is connected
    if (!socketService.isConnected()) {
      try {
        await socketService.connect();
      } catch (err) {
        this.isStreaming = false;
        callbacks.onError(new Error('Failed to connect to server'));
        return;
      }
    }
    
    // Add system prompt to messages
    const messagesWithSystem: AIAgentMessage[] = [
      { role: 'system', content: AGENTIC_SYSTEM_PROMPT },
      ...messages,
    ];
    
    // Start streaming
    socketService.streamAIChat(
      messagesWithSystem,
      provider,
      model,
      {
        onChunk: (content) => {
          this.currentResponse += content;
          callbacks.onToken(content);
        },
        onDone: () => {
          this.isStreaming = false;
          
          // Parse and execute file operations
          const operations = this.parseOperations(this.currentResponse);
          operations.forEach(op => {
            callbacks.onFileOperation?.(op);
          });
          
          // Parse terminal commands
          const commands = this.parseTerminalCommands(this.currentResponse);
          commands.forEach(cmd => {
            callbacks.onTerminalCommand?.(cmd, '');
          });
          
          // Return clean response
          const cleanedResponse = this.cleanResponse(this.currentResponse);
          callbacks.onComplete(cleanedResponse || this.currentResponse);
        },
        onError: (error) => {
          this.isStreaming = false;
          callbacks.onError(new Error(error));
        },
      }
    );
  }
  
  // Send message via REST API (fallback)
  async sendMessage(
    messages: AIAgentMessage[],
    provider: string = 'openai',
    model: string = 'gpt-4o-mini'
  ): Promise<{ response: string; operations: FileOperation[]; commands: string[] }> {
    // Use same origin in production, localhost in development
    const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? `${window.location.origin}/api`
      : 'http://localhost:4000/api';
    
    const messagesWithSystem = [
      { role: 'system', content: AGENTIC_SYSTEM_PROMPT },
      ...messages,
    ];
    
    const response = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messagesWithSystem.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
          content: m.content,
        })),
        provider,
        model,
        temperature: 0.7,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${error}`);
    }
    
    const data = await response.json();
    const aiResponse = data.response || '';
    
    return {
      response: this.cleanResponse(aiResponse) || aiResponse,
      operations: this.parseOperations(aiResponse),
      commands: this.parseTerminalCommands(aiResponse),
    };
  }
  
  // Cancel current stream
  cancelStream(): void {
    // Socket.IO doesn't have a direct cancel, but we can stop processing
    this.isStreaming = false;
    this.currentResponse = '';
  }
  
  // Check if currently streaming
  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }
}

// Export singleton
export const aiAgentService = new AIAgentService();

// Also export class for testing
export { AIAgentService };
