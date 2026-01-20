/**
 * Dyad-style Tag Parser
 * Extracts file operations from AI responses using XML-like tags
 * Based on Apache 2.0 licensed Dyad project patterns
 */

export interface WriteTag {
  path: string;
  content: string;
  description?: string;
}

export interface RenameTag {
  from: string;
  to: string;
}

export interface SearchReplaceTag {
  path: string;
  content: string;
  description?: string;
}

export interface DependencyTag {
  packages: string[];
}

export interface CommandTag {
  type: 'rebuild' | 'restart' | 'refresh';
}

export interface ParsedResponse {
  writeTags: WriteTag[];
  renameTags: RenameTag[];
  deletePaths: string[];
  dependencies: string[];
  commands: CommandTag[];
  searchReplaceTags: SearchReplaceTag[];
  chatSummary: string | null;
  cleanContent: string;
}

// Normalize path to use forward slashes
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

// Extract <dyad-write path="...">...</dyad-write> tags
export function getDyadWriteTags(fullResponse: string): WriteTag[] {
  const regex = /<dyad-write([^>]*)>([\s\S]*?)<\/dyad-write>/gi;
  const pathRegex = /path="([^"]+)"/;
  const descriptionRegex = /description="([^"]+)"/;

  const tags: WriteTag[] = [];
  let match;

  while ((match = regex.exec(fullResponse)) !== null) {
    const attributesString = match[1];
    let content = match[2].trim();

    const pathMatch = pathRegex.exec(attributesString);
    const descriptionMatch = descriptionRegex.exec(attributesString);

    if (pathMatch && pathMatch[1]) {
      const path = pathMatch[1];
      const description = descriptionMatch?.[1];

      // Remove markdown code fences if present
      const contentLines = content.split('\n');
      if (contentLines[0]?.startsWith('```')) {
        contentLines.shift();
      }
      if (contentLines[contentLines.length - 1]?.startsWith('```')) {
        contentLines.pop();
      }
      content = contentLines.join('\n');

      tags.push({ path: normalizePath(path), content, description });
    }
  }
  return tags;
}

// Also support <file_create> tags for backwards compatibility
export function getFileCreateTags(fullResponse: string): WriteTag[] {
  const regex = /<file_create\s+path="([^"]+)">([\s\S]*?)<\/file_create>/gi;
  const tags: WriteTag[] = [];
  let match;

  while ((match = regex.exec(fullResponse)) !== null) {
    let content = match[2].trim();
    const path = match[1];

    // Remove markdown code fences if present
    const contentLines = content.split('\n');
    if (contentLines[0]?.startsWith('```')) {
      contentLines.shift();
    }
    if (contentLines[contentLines.length - 1]?.startsWith('```')) {
      contentLines.pop();
    }
    content = contentLines.join('\n');

    tags.push({ path: normalizePath(path), content });
  }
  return tags;
}

// Extract <dyad-rename from="..." to="..."></dyad-rename> tags
export function getDyadRenameTags(fullResponse: string): RenameTag[] {
  const regex = /<dyad-rename from="([^"]+)" to="([^"]+)"[^>]*>([\s\S]*?)<\/dyad-rename>/g;
  const tags: RenameTag[] = [];
  let match;

  while ((match = regex.exec(fullResponse)) !== null) {
    tags.push({
      from: normalizePath(match[1]),
      to: normalizePath(match[2]),
    });
  }
  return tags;
}

// Extract <dyad-delete path="..."></dyad-delete> tags
export function getDyadDeleteTags(fullResponse: string): string[] {
  const regex = /<dyad-delete path="([^"]+)"[^>]*>([\s\S]*?)<\/dyad-delete>/g;
  const paths: string[] = [];
  let match;

  while ((match = regex.exec(fullResponse)) !== null) {
    paths.push(normalizePath(match[1]));
  }
  return paths;
}

// Also support <file_delete> tags for backwards compatibility
export function getFileDeleteTags(fullResponse: string): string[] {
  const regex = /<file_delete\s+path="([^"]+)"[^>]*\/?>(?:<\/file_delete>)?/gi;
  const paths: string[] = [];
  let match;

  while ((match = regex.exec(fullResponse)) !== null) {
    paths.push(normalizePath(match[1]));
  }
  return paths;
}

// Extract <dyad-add-dependency packages="..."></dyad-add-dependency> tags
export function getDyadAddDependencyTags(fullResponse: string): string[] {
  const regex = /<dyad-add-dependency packages="([^"]+)">[^<]*<\/dyad-add-dependency>/g;
  const packages: string[] = [];
  let match;

  while ((match = regex.exec(fullResponse)) !== null) {
    packages.push(...match[1].split(' '));
  }
  return packages;
}

// Extract <dyad-chat-summary>...</dyad-chat-summary> tags
export function getDyadChatSummaryTag(fullResponse: string): string | null {
  const regex = /<dyad-chat-summary>([\s\S]*?)<\/dyad-chat-summary>/g;
  const match = regex.exec(fullResponse);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

// Extract <dyad-command type="..."></dyad-command> tags
export function getDyadCommandTags(fullResponse: string): CommandTag[] {
  const regex = /<dyad-command type="([^"]+)"[^>]*><\/dyad-command>/g;
  const commands: CommandTag[] = [];
  let match;

  while ((match = regex.exec(fullResponse)) !== null) {
    const type = match[1] as 'rebuild' | 'restart' | 'refresh';
    if (['rebuild', 'restart', 'refresh'].includes(type)) {
      commands.push({ type });
    }
  }
  return commands;
}

// Extract <dyad-search-replace path="...">...</dyad-search-replace> tags
export function getDyadSearchReplaceTags(fullResponse: string): SearchReplaceTag[] {
  const regex = /<dyad-search-replace([^>]*)>([\s\S]*?)<\/dyad-search-replace>/gi;
  const pathRegex = /path="([^"]+)"/;
  const descriptionRegex = /description="([^"]+)"/;

  const tags: SearchReplaceTag[] = [];
  let match;

  while ((match = regex.exec(fullResponse)) !== null) {
    const attributesString = match[1] || '';
    let content = match[2].trim();

    const pathMatch = pathRegex.exec(attributesString);
    const descriptionMatch = descriptionRegex.exec(attributesString);

    if (pathMatch && pathMatch[1]) {
      const path = pathMatch[1];
      const description = descriptionMatch?.[1];

      // Handle markdown code fences
      const contentLines = content.split('\n');
      if (contentLines[0]?.startsWith('```')) {
        contentLines.shift();
      }
      if (contentLines[contentLines.length - 1]?.startsWith('```')) {
        contentLines.pop();
      }
      content = contentLines.join('\n');

      tags.push({ path: normalizePath(path), content, description });
    }
  }
  return tags;
}

// Also support <file_edit> tags for backwards compatibility
export function getFileEditTags(fullResponse: string): SearchReplaceTag[] {
  const regex = /<file_edit\s+path="([^"]+)">([\s\S]*?)<\/file_edit>/gi;
  const tags: SearchReplaceTag[] = [];
  let match;

  while ((match = regex.exec(fullResponse)) !== null) {
    let content = match[2].trim();
    const path = match[1];

    // Remove markdown code fences if present
    const contentLines = content.split('\n');
    if (contentLines[0]?.startsWith('```')) {
      contentLines.shift();
    }
    if (contentLines[contentLines.length - 1]?.startsWith('```')) {
      contentLines.pop();
    }
    content = contentLines.join('\n');

    tags.push({ path: normalizePath(path), content });
  }
  return tags;
}

// Clean response for display (remove operation tags, keep explanation)
export function cleanForDisplay(content: string): string {
  // Remove all operation tags but keep the surrounding explanation
  return content
    // Dyad tags
    .replace(/<dyad-write[^>]*>[\s\S]*?<\/dyad-write>/gi, '📄 *Creating file...*')
    .replace(/<dyad-delete[^>]*>[\s\S]*?<\/dyad-delete>/gi, '🗑️ *Deleting file...*')
    .replace(/<dyad-rename[^>]*>[\s\S]*?<\/dyad-rename>/gi, '📝 *Renaming file...*')
    .replace(/<dyad-search-replace[^>]*>[\s\S]*?<\/dyad-search-replace>/gi, '✏️ *Editing file...*')
    .replace(/<dyad-add-dependency[^>]*>[\s\S]*?<\/dyad-add-dependency>/gi, '📦 *Installing dependencies...*')
    .replace(/<dyad-command[^>]*><\/dyad-command>/gi, '⚡ *Running command...*')
    .replace(/<dyad-chat-summary>[\s\S]*?<\/dyad-chat-summary>/gi, '')
    // Legacy tags
    .replace(/<file_create[^>]*>[\s\S]*?<\/file_create>/gi, '📄 *Creating file...*')
    .replace(/<file_edit[^>]*>[\s\S]*?<\/file_edit>/gi, '✏️ *Editing file...*')
    .replace(/<file_delete[^>]*\/?>/gi, '🗑️ *Deleting file...*')
    .replace(/<terminal_command>[\s\S]*?<\/terminal_command>/gi, '💻 *Running command...*')
    .trim();
}

// Parse entire response and extract all operations
export function parseAIResponse(fullResponse: string): ParsedResponse {
  // Combine both Dyad and legacy tag formats
  const writeTags = [
    ...getDyadWriteTags(fullResponse),
    ...getFileCreateTags(fullResponse),
  ];

  const searchReplaceTags = [
    ...getDyadSearchReplaceTags(fullResponse),
    ...getFileEditTags(fullResponse),
  ];

  const deletePaths = [
    ...getDyadDeleteTags(fullResponse),
    ...getFileDeleteTags(fullResponse),
  ];

  return {
    writeTags,
    renameTags: getDyadRenameTags(fullResponse),
    deletePaths,
    dependencies: getDyadAddDependencyTags(fullResponse),
    commands: getDyadCommandTags(fullResponse),
    searchReplaceTags,
    chatSummary: getDyadChatSummaryTag(fullResponse),
    cleanContent: cleanForDisplay(fullResponse),
  };
}

// Apply search-replace operation to file content
export function applySearchReplace(
  original: string,
  diffContent: string
): { success: boolean; content?: string; error?: string } {
  try {
    // Parse the diff format: <<<<<<< SEARCH ... ======= ... >>>>>>> REPLACE
    const searchReplaceRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    
    let result = original;
    let match;
    let hasMatches = false;

    while ((match = searchReplaceRegex.exec(diffContent)) !== null) {
      hasMatches = true;
      const searchText = match[1];
      const replaceText = match[2];

      if (!result.includes(searchText)) {
        return {
          success: false,
          error: `Search text not found in file: "${searchText.substring(0, 50)}..."`,
        };
      }

      result = result.replace(searchText, replaceText);
    }

    if (!hasMatches) {
      // If no search-replace blocks, treat entire content as replacement
      return { success: true, content: diffContent };
    }

    return { success: true, content: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
