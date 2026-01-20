/**
 * Response Processor Service
 * Processes AI responses and executes file operations
 * Inspired by Dyad's architecture (Apache 2.0)
 */

import { 
  parseAIResponse, 
  applySearchReplace,
  ParsedResponse,
  WriteTag,
  SearchReplaceTag,
  CommandTag,
} from './dyadParser';

export interface FileSystem {
  readFile: (path: string) => string | null;
  writeFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  renameFile: (from: string, to: string) => void;
  createFolder: (path: string) => void;
  fileExists: (path: string) => boolean;
}

export interface ProcessResult {
  success: boolean;
  writtenFiles: string[];
  deletedFiles: string[];
  renamedFiles: { from: string; to: string }[];
  editedFiles: string[];
  errors: { file: string; error: string }[];
  commands: CommandTag[];
  dependencies: string[];
}

/**
 * Process AI response and execute file operations
 */
export async function processAIResponse(
  fullResponse: string,
  fileSystem: FileSystem
): Promise<ProcessResult> {
  const parsed = parseAIResponse(fullResponse);
  
  const result: ProcessResult = {
    success: true,
    writtenFiles: [],
    deletedFiles: [],
    renamedFiles: [],
    editedFiles: [],
    errors: [],
    commands: parsed.commands,
    dependencies: parsed.dependencies,
  };

  // Process write operations (create new files)
  for (const tag of parsed.writeTags) {
    try {
      await processWriteTag(tag, fileSystem);
      result.writtenFiles.push(tag.path);
    } catch (error) {
      result.errors.push({
        file: tag.path,
        error: error instanceof Error ? error.message : 'Failed to write file',
      });
      result.success = false;
    }
  }

  // Process search-replace operations (edit existing files)
  for (const tag of parsed.searchReplaceTags) {
    try {
      await processSearchReplaceTag(tag, fileSystem);
      result.editedFiles.push(tag.path);
    } catch (error) {
      result.errors.push({
        file: tag.path,
        error: error instanceof Error ? error.message : 'Failed to edit file',
      });
      result.success = false;
    }
  }

  // Process delete operations
  for (const path of parsed.deletePaths) {
    try {
      if (fileSystem.fileExists(path)) {
        fileSystem.deleteFile(path);
        result.deletedFiles.push(path);
      }
    } catch (error) {
      result.errors.push({
        file: path,
        error: error instanceof Error ? error.message : 'Failed to delete file',
      });
      result.success = false;
    }
  }

  // Process rename operations
  for (const tag of parsed.renameTags) {
    try {
      if (fileSystem.fileExists(tag.from)) {
        fileSystem.renameFile(tag.from, tag.to);
        result.renamedFiles.push({ from: tag.from, to: tag.to });
      }
    } catch (error) {
      result.errors.push({
        file: tag.from,
        error: error instanceof Error ? error.message : 'Failed to rename file',
      });
      result.success = false;
    }
  }

  return result;
}

/**
 * Process a write tag - create new file or overwrite existing
 */
async function processWriteTag(tag: WriteTag, fileSystem: FileSystem): Promise<void> {
  // Ensure parent directory exists
  const pathParts = tag.path.split('/');
  if (pathParts.length > 1) {
    const parentPath = pathParts.slice(0, -1).join('/');
    ensureDirectoryExists(parentPath, fileSystem);
  }

  // Write the file
  fileSystem.writeFile(tag.path, tag.content);
}

/**
 * Process a search-replace tag - edit existing file
 */
async function processSearchReplaceTag(tag: SearchReplaceTag, fileSystem: FileSystem): Promise<void> {
  const existingContent = fileSystem.readFile(tag.path);
  
  if (existingContent === null) {
    // File doesn't exist, create it with the new content
    await processWriteTag({ path: tag.path, content: tag.content }, fileSystem);
    return;
  }

  // Apply search-replace
  const result = applySearchReplace(existingContent, tag.content);
  
  if (!result.success || !result.content) {
    throw new Error(result.error || 'Failed to apply search-replace');
  }

  fileSystem.writeFile(tag.path, result.content);
}

/**
 * Ensure directory exists, creating parent directories as needed
 */
function ensureDirectoryExists(path: string, fileSystem: FileSystem): void {
  const parts = path.split('/').filter(Boolean);
  let currentPath = '';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    fileSystem.createFolder(currentPath);
  }
}

/**
 * Get language from file extension
 */
export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'json': 'json',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'env': 'plaintext',
    'txt': 'plaintext',
    'xml': 'xml',
    'svg': 'xml',
    'sql': 'sql',
    'graphql': 'graphql',
    'gql': 'graphql',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'kt': 'kotlin',
    'swift': 'swift',
    'rb': 'ruby',
    'php': 'php',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'vue': 'vue',
    'svelte': 'svelte',
  };

  return languageMap[ext] || 'plaintext';
}

/**
 * Create a file system adapter from store functions
 */
export function createFileSystemAdapter(store: {
  files: any[];
  createFile: (parentPath: string, name: string, content: string) => void;
  createFolder: (parentPath: string, name: string) => void;
  updateFileContent: (path: string, content: string) => void;
  deleteFile?: (path: string) => void;
}): FileSystem {
  return {
    readFile: (path: string) => {
      const file = findFileByPath(store.files, path);
      return file?.content ?? null;
    },
    writeFile: (path: string, content: string) => {
      const existing = findFileByPath(store.files, path);
      if (existing) {
        store.updateFileContent(path, content);
      } else {
        const pathParts = path.split('/');
        const fileName = pathParts.pop() || path;
        const parentPath = pathParts.join('/');
        store.createFile(parentPath, fileName, content);
      }
    },
    deleteFile: (path: string) => {
      if (store.deleteFile) {
        store.deleteFile(path);
      }
    },
    renameFile: (from: string, to: string) => {
      // Read, delete, write with new path
      const content = findFileByPath(store.files, from)?.content ?? '';
      if (store.deleteFile) {
        store.deleteFile(from);
      }
      const pathParts = to.split('/');
      const fileName = pathParts.pop() || to;
      const parentPath = pathParts.join('/');
      store.createFile(parentPath, fileName, content);
    },
    createFolder: (path: string) => {
      const pathParts = path.split('/');
      const folderName = pathParts.pop() || path;
      const parentPath = pathParts.join('/');
      store.createFolder(parentPath, folderName);
    },
    fileExists: (path: string) => {
      return findFileByPath(store.files, path) !== null;
    },
  };
}

/**
 * Find a file by path in the file tree
 */
function findFileByPath(files: any[], targetPath: string): any | null {
  for (const file of files) {
    if (file.path === targetPath) {
      return file;
    }
    if (file.children) {
      const found = findFileByPath(file.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Generate a summary of changes made
 */
export function generateChangeSummary(result: ProcessResult): string {
  const parts: string[] = [];

  if (result.writtenFiles.length > 0) {
    parts.push(`📄 Created: ${result.writtenFiles.join(', ')}`);
  }

  if (result.editedFiles.length > 0) {
    parts.push(`✏️ Edited: ${result.editedFiles.join(', ')}`);
  }

  if (result.deletedFiles.length > 0) {
    parts.push(`🗑️ Deleted: ${result.deletedFiles.join(', ')}`);
  }

  if (result.renamedFiles.length > 0) {
    const renames = result.renamedFiles.map(r => `${r.from} → ${r.to}`).join(', ');
    parts.push(`📝 Renamed: ${renames}`);
  }

  if (result.dependencies.length > 0) {
    parts.push(`📦 Dependencies: ${result.dependencies.join(', ')}`);
  }

  if (result.errors.length > 0) {
    const errors = result.errors.map(e => `${e.file}: ${e.error}`).join('; ');
    parts.push(`❌ Errors: ${errors}`);
  }

  return parts.join('\n');
}
