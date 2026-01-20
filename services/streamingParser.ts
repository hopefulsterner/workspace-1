/**
 * Real-time Streaming Parser
 * Parses AI response as it streams and executes file operations immediately
 */

export interface StreamingFileOperation {
  type: 'create' | 'edit' | 'delete' | 'rename';
  path: string;
  content: string;
  isComplete: boolean;
}

export interface StreamingCommand {
  type: 'install' | 'start' | 'rebuild' | 'terminal';
  command?: string;
}

export interface StreamingState {
  currentFile: StreamingFileOperation | null;
  completedFiles: StreamingFileOperation[];
  displayContent: string;
  rawContent: string;
}

/**
 * Real-time streaming parser that detects file operations as they stream in
 */
export class StreamingParser {
  private rawContent: string = '';
  private completedFiles: StreamingFileOperation[] = [];
  private currentFile: StreamingFileOperation | null = null;
  private executedCommands: Set<string> = new Set();
  private onFileStart: (file: StreamingFileOperation) => void;
  private onFileProgress: (file: StreamingFileOperation) => void;
  private onFileComplete: (file: StreamingFileOperation) => void;
  private onCommand?: (command: StreamingCommand) => void;

  constructor(callbacks: {
    onFileStart: (file: StreamingFileOperation) => void;
    onFileProgress: (file: StreamingFileOperation) => void;
    onFileComplete: (file: StreamingFileOperation) => void;
    onCommand?: (command: StreamingCommand) => void;
  }) {
    this.onFileStart = callbacks.onFileStart;
    this.onFileProgress = callbacks.onFileProgress;
    this.onFileComplete = callbacks.onFileComplete;
    this.onCommand = callbacks.onCommand;
  }

  /**
   * Process a new token from the stream
   */
  processToken(token: string): string {
    this.rawContent += token;
    
    // Check for new file operations starting
    this.detectNewFileOperations();
    
    // Update current file content if we're inside one
    this.updateCurrentFileContent();
    
    // Check for completed file operations
    this.detectCompletedOperations();
    
    // Check for command tags
    this.detectCommands();
    
    // Return cleaned display content
    return this.getDisplayContent();
  }

  /**
   * Detect dyad-command and dyad-terminal tags
   */
  private detectCommands(): void {
    if (!this.onCommand) return;

    // Detect <dyad-command type="install|start|rebuild">
    const commandMatches = this.rawContent.matchAll(/<dyad-command\s+type="(install|start|rebuild)"[^>]*><\/dyad-command>/gi);
    for (const match of commandMatches) {
      const commandKey = `command:${match[1]}`;
      if (!this.executedCommands.has(commandKey)) {
        this.executedCommands.add(commandKey);
        this.onCommand({ type: match[1] as 'install' | 'start' | 'rebuild' });
      }
    }

    // Detect <dyad-terminal>command here</dyad-terminal>
    const terminalMatches = this.rawContent.matchAll(/<dyad-terminal>([^<]+)<\/dyad-terminal>/gi);
    for (const match of terminalMatches) {
      const commandKey = `terminal:${match[1]}`;
      if (!this.executedCommands.has(commandKey)) {
        this.executedCommands.add(commandKey);
        this.onCommand({ type: 'terminal', command: match[1].trim() });
      }
    }
  }

  /**
   * Detect when a new file operation tag starts
   */
  private detectNewFileOperations(): void {
    if (this.currentFile) return; // Already tracking a file

    // Check for dyad-write tag
    const writeMatch = this.rawContent.match(/<dyad-write\s+path="([^"]+)"[^>]*>(?![\s\S]*<\/dyad-write>)/);
    if (writeMatch) {
      const path = writeMatch[1];
      const tagEnd = this.rawContent.indexOf('>', this.rawContent.indexOf('<dyad-write'));
      const contentStart = tagEnd + 1;
      const content = this.rawContent.substring(contentStart);
      
      this.currentFile = {
        type: 'create',
        path: this.normalizePath(path),
        content: this.cleanCodeContent(content),
        isComplete: false,
      };
      this.onFileStart(this.currentFile);
      return;
    }

    // Check for file_create tag (legacy)
    const createMatch = this.rawContent.match(/<file_create\s+path="([^"]+)"[^>]*>(?![\s\S]*<\/file_create>)/);
    if (createMatch) {
      const path = createMatch[1];
      const tagEnd = this.rawContent.indexOf('>', this.rawContent.indexOf('<file_create'));
      const contentStart = tagEnd + 1;
      const content = this.rawContent.substring(contentStart);
      
      this.currentFile = {
        type: 'create',
        path: this.normalizePath(path),
        content: this.cleanCodeContent(content),
        isComplete: false,
      };
      this.onFileStart(this.currentFile);
      return;
    }

    // Check for dyad-search-replace tag
    const editMatch = this.rawContent.match(/<dyad-search-replace\s+path="([^"]+)"[^>]*>(?![\s\S]*<\/dyad-search-replace>)/);
    if (editMatch) {
      const path = editMatch[1];
      const tagEnd = this.rawContent.indexOf('>', this.rawContent.indexOf('<dyad-search-replace'));
      const contentStart = tagEnd + 1;
      const content = this.rawContent.substring(contentStart);
      
      this.currentFile = {
        type: 'edit',
        path: this.normalizePath(path),
        content: this.cleanCodeContent(content),
        isComplete: false,
      };
      this.onFileStart(this.currentFile);
      return;
    }

    // Check for file_edit tag (legacy)
    const fileEditMatch = this.rawContent.match(/<file_edit\s+path="([^"]+)"[^>]*>(?![\s\S]*<\/file_edit>)/);
    if (fileEditMatch) {
      const path = fileEditMatch[1];
      const tagEnd = this.rawContent.indexOf('>', this.rawContent.indexOf('<file_edit'));
      const contentStart = tagEnd + 1;
      const content = this.rawContent.substring(contentStart);
      
      this.currentFile = {
        type: 'edit',
        path: this.normalizePath(path),
        content: this.cleanCodeContent(content),
        isComplete: false,
      };
      this.onFileStart(this.currentFile);
    }
  }

  /**
   * Update current file content as more tokens come in
   */
  private updateCurrentFileContent(): void {
    if (!this.currentFile) return;

    // Find where current tag content starts
    let tagName = this.currentFile.type === 'create' ? 'dyad-write|file_create' : 'dyad-search-replace|file_edit';
    const tagPattern = new RegExp(`<(${tagName})\\s+path="${this.escapeRegex(this.currentFile.path)}"[^>]*>`);
    const match = this.rawContent.match(tagPattern);
    
    if (match) {
      const tagEnd = this.rawContent.indexOf('>', match.index!) + 1;
      const closeTag = `</${match[1]}>`;
      const closeIndex = this.rawContent.indexOf(closeTag, tagEnd);
      
      if (closeIndex === -1) {
        // Tag not closed yet, get all content after tag
        this.currentFile.content = this.cleanCodeContent(this.rawContent.substring(tagEnd));
      } else {
        // Tag is closed
        this.currentFile.content = this.cleanCodeContent(this.rawContent.substring(tagEnd, closeIndex));
      }
      
      this.onFileProgress(this.currentFile);
    }
  }

  /**
   * Detect when file operations complete
   */
  private detectCompletedOperations(): void {
    if (!this.currentFile) return;

    const closeTagPatterns = [
      '</dyad-write>',
      '</file_create>',
      '</dyad-search-replace>',
      '</file_edit>',
    ];

    for (const closeTag of closeTagPatterns) {
      if (this.rawContent.includes(closeTag)) {
        // Find the corresponding open tag and extract final content
        const tagName = closeTag.replace('</', '').replace('>', '');
        const openTagPattern = new RegExp(`<${tagName}\\s+path="[^"]*"[^>]*>`);
        const openMatch = this.rawContent.match(openTagPattern);
        
        if (openMatch) {
          const openTagEnd = this.rawContent.indexOf('>', openMatch.index!) + 1;
          const closeIndex = this.rawContent.indexOf(closeTag);
          
          if (closeIndex > openTagEnd) {
            this.currentFile.content = this.cleanCodeContent(
              this.rawContent.substring(openTagEnd, closeIndex)
            );
            this.currentFile.isComplete = true;
            
            this.completedFiles.push({ ...this.currentFile });
            this.onFileComplete(this.currentFile);
            this.currentFile = null;
            return;
          }
        }
      }
    }
  }

  /**
   * Get cleaned content for display (hide file operation tags)
   */
  private getDisplayContent(): string {
    let display = this.rawContent;
    
    // Replace completed file operations with status messages
    display = display
      .replace(/<dyad-write[^>]*>[\s\S]*?<\/dyad-write>/gi, '\n✅ File created\n')
      .replace(/<file_create[^>]*>[\s\S]*?<\/file_create>/gi, '\n✅ File created\n')
      .replace(/<dyad-search-replace[^>]*>[\s\S]*?<\/dyad-search-replace>/gi, '\n✅ File updated\n')
      .replace(/<file_edit[^>]*>[\s\S]*?<\/file_edit>/gi, '\n✅ File updated\n')
      .replace(/<dyad-delete[^>]*>[\s\S]*?<\/dyad-delete>/gi, '\n🗑️ File deleted\n')
      .replace(/<file_delete[^>]*\/?>/gi, '\n🗑️ File deleted\n')
      .replace(/<dyad-command\s+type="install"[^>]*><\/dyad-command>/gi, '\n📦 Installing dependencies...\n')
      .replace(/<dyad-command\s+type="start"[^>]*><\/dyad-command>/gi, '\n🚀 Starting server...\n')
      .replace(/<dyad-command\s+type="rebuild"[^>]*><\/dyad-command>/gi, '\n🔄 Rebuilding project...\n')
      .replace(/<dyad-terminal>([^<]+)<\/dyad-terminal>/gi, '\n💻 Running: `$1`\n');
    
    // Replace in-progress file operations with streaming indicator
    if (this.currentFile) {
      const icon = this.currentFile.type === 'create' ? '📄' : '✏️';
      const action = this.currentFile.type === 'create' ? 'Creating' : 'Editing';
      
      // Hide the current incomplete tag content
      display = display
        .replace(/<dyad-write[^>]*>[\s\S]*$/gi, `\n${icon} ${action}: \`${this.currentFile.path}\`...\n`)
        .replace(/<file_create[^>]*>[\s\S]*$/gi, `\n${icon} ${action}: \`${this.currentFile.path}\`...\n`)
        .replace(/<dyad-search-replace[^>]*>[\s\S]*$/gi, `\n${icon} ${action}: \`${this.currentFile.path}\`...\n`)
        .replace(/<file_edit[^>]*>[\s\S]*$/gi, `\n${icon} ${action}: \`${this.currentFile.path}\`...\n`);
    }
    
    return display.trim();
  }

  /**
   * Clean code content (remove markdown fences)
   */
  private cleanCodeContent(content: string): string {
    const lines = content.split('\n');
    
    // Remove leading markdown fence
    if (lines[0]?.trim().startsWith('```')) {
      lines.shift();
    }
    
    // Remove trailing markdown fence
    if (lines[lines.length - 1]?.trim().startsWith('```')) {
      lines.pop();
    }
    
    return lines.join('\n');
  }

  /**
   * Normalize path
   */
  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/^\/+/, '');
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.rawContent = '';
    this.completedFiles = [];
    this.currentFile = null;
    this.executedCommands = new Set();
  }

  /**
   * Get all completed files
   */
  getCompletedFiles(): StreamingFileOperation[] {
    return this.completedFiles;
  }

  /**
   * Get current file being written
   */
  getCurrentFile(): StreamingFileOperation | null {
    return this.currentFile;
  }
}
