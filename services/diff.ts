// Diff Engine - Compute and visualize code differences

export interface DiffLine {
  type: 'add' | 'remove' | 'unchanged' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffResult {
  oldFile: string;
  newFile: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  isBinary: boolean;
}

// LCS-based diff algorithm
function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

// Backtrack to find the diff
function backtrack(dp: number[][], a: string[], b: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  let i = a.length;
  let j = b.length;
  let oldLine = a.length;
  let newLine = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({
        type: 'unchanged',
        content: a[i - 1],
        oldLineNumber: oldLine,
        newLineNumber: newLine,
      });
      i--;
      j--;
      oldLine--;
      newLine--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'add',
        content: b[j - 1],
        newLineNumber: newLine,
      });
      j--;
      newLine--;
    } else if (i > 0) {
      result.unshift({
        type: 'remove',
        content: a[i - 1],
        oldLineNumber: oldLine,
      });
      i--;
      oldLine--;
    }
  }

  return result;
}

// Compute diff between two strings
export function computeDiff(oldText: string, newText: string, contextLines = 3): DiffResult {
  // Check for binary content
  const isBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(oldText) || 
                   /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(newText);

  if (isBinary) {
    return {
      oldFile: 'old',
      newFile: 'new',
      hunks: [],
      additions: 0,
      deletions: 0,
      isBinary: true,
    };
  }

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const dp = lcs(oldLines, newLines);
  const diffLines = backtrack(dp, oldLines, newLines);

  // Group into hunks with context
  const hunks = groupIntoHunks(diffLines, contextLines);

  // Count additions and deletions
  let additions = 0;
  let deletions = 0;
  for (const line of diffLines) {
    if (line.type === 'add') additions++;
    if (line.type === 'remove') deletions++;
  }

  return {
    oldFile: 'old',
    newFile: 'new',
    hunks,
    additions,
    deletions,
    isBinary: false,
  };
}

// Group diff lines into hunks with context
function groupIntoHunks(lines: DiffLine[], contextLines: number): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffLine[] = [];
  let unchangedCount = 0;
  let hunkStart = -1;
  let oldStart = 0;
  let newStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.type === 'unchanged') {
      unchangedCount++;
      
      if (currentHunk.length > 0 && unchangedCount > contextLines * 2) {
        // End current hunk
        // Add trailing context
        const trailingContext = lines.slice(
          Math.max(hunkStart, i - contextLines - unchangedCount + 1),
          i - unchangedCount + contextLines + 1
        );
        
        const hunk = createHunk(currentHunk.concat(
          trailingContext.filter(l => l.type === 'unchanged').slice(0, contextLines)
        ), oldStart, newStart);
        
        if (hunk.lines.some(l => l.type !== 'unchanged')) {
          hunks.push(hunk);
        }
        
        currentHunk = [];
        unchangedCount = 0;
        hunkStart = -1;
      }
    } else {
      // Found a change
      if (currentHunk.length === 0) {
        // Start new hunk with leading context
        hunkStart = Math.max(0, i - contextLines);
        oldStart = lines[hunkStart]?.oldLineNumber || 1;
        newStart = lines[hunkStart]?.newLineNumber || 1;
        
        // Add leading context
        for (let j = hunkStart; j < i; j++) {
          if (lines[j].type === 'unchanged') {
            currentHunk.push({ ...lines[j], type: 'context' });
          }
        }
      } else if (unchangedCount > 0) {
        // Add intermediate context
        for (let j = i - unchangedCount; j < i; j++) {
          currentHunk.push({ ...lines[j], type: 'context' });
        }
      }
      
      currentHunk.push(line);
      unchangedCount = 0;
    }
  }

  // Handle remaining hunk
  if (currentHunk.length > 0 && currentHunk.some(l => l.type !== 'context')) {
    const hunk = createHunk(currentHunk, oldStart, newStart);
    hunks.push(hunk);
  }

  return hunks;
}

function createHunk(lines: DiffLine[], oldStart: number, newStart: number): DiffHunk {
  let oldLines = 0;
  let newLines = 0;

  for (const line of lines) {
    if (line.type === 'remove') {
      oldLines++;
    } else if (line.type === 'add') {
      newLines++;
    } else {
      oldLines++;
      newLines++;
    }
  }

  return {
    oldStart,
    oldLines,
    newStart,
    newLines,
    lines,
  };
}

// Format diff as unified diff string
export function formatUnifiedDiff(diff: DiffResult, oldPath: string, newPath: string): string {
  if (diff.isBinary) {
    return `Binary files ${oldPath} and ${newPath} differ`;
  }

  let output = `--- ${oldPath}\n+++ ${newPath}\n`;

  for (const hunk of diff.hunks) {
    output += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
    
    for (const line of hunk.lines) {
      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
      output += `${prefix}${line.content}\n`;
    }
  }

  return output;
}

// Generate HTML for side-by-side diff view
export function generateSideBySideHtml(diff: DiffResult): { left: string; right: string } {
  let left = '';
  let right = '';

  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'remove') {
        left += `<div class="diff-line diff-remove"><span class="line-number">${line.oldLineNumber || ''}</span><span class="line-content">${escapeHtml(line.content)}</span></div>`;
        right += `<div class="diff-line diff-empty"><span class="line-number"></span><span class="line-content"></span></div>`;
      } else if (line.type === 'add') {
        left += `<div class="diff-line diff-empty"><span class="line-number"></span><span class="line-content"></span></div>`;
        right += `<div class="diff-line diff-add"><span class="line-number">${line.newLineNumber || ''}</span><span class="line-content">${escapeHtml(line.content)}</span></div>`;
      } else {
        left += `<div class="diff-line"><span class="line-number">${line.oldLineNumber || ''}</span><span class="line-content">${escapeHtml(line.content)}</span></div>`;
        right += `<div class="diff-line"><span class="line-number">${line.newLineNumber || ''}</span><span class="line-content">${escapeHtml(line.content)}</span></div>`;
      }
    }
  }

  return { left, right };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Word-level diff for more granular changes
export function computeWordDiff(oldLine: string, newLine: string): { old: string; new: string } {
  const oldWords = oldLine.split(/(\s+)/);
  const newWords = newLine.split(/(\s+)/);
  
  const dp = lcs(oldWords, newWords);
  const diffWords = backtrack(dp, oldWords, newWords);
  
  let oldResult = '';
  let newResult = '';
  
  for (const word of diffWords) {
    if (word.type === 'remove') {
      oldResult += `<del>${escapeHtml(word.content)}</del>`;
    } else if (word.type === 'add') {
      newResult += `<ins>${escapeHtml(word.content)}</ins>`;
    } else {
      oldResult += escapeHtml(word.content);
      newResult += escapeHtml(word.content);
    }
  }
  
  return { old: oldResult, new: newResult };
}

// Three-way merge for conflict resolution
export function threeWayMerge(base: string, ours: string, theirs: string): { 
  result: string; 
  conflicts: Array<{ start: number; end: number; ours: string; theirs: string }> 
} {
  const baseLines = base.split('\n');
  const ourLines = ours.split('\n');
  const theirLines = theirs.split('\n');
  
  const ourDiff = computeDiff(base, ours);
  const theirDiff = computeDiff(base, theirs);
  
  // Simple merge strategy
  const result: string[] = [];
  const conflicts: Array<{ start: number; end: number; ours: string; theirs: string }> = [];
  
  let i = 0;
  let conflictStart = -1;
  
  while (i < Math.max(baseLines.length, ourLines.length, theirLines.length)) {
    const baseLine = baseLines[i] || '';
    const ourLine = ourLines[i] || '';
    const theirLine = theirLines[i] || '';
    
    if (ourLine === theirLine) {
      // Both changed the same way or both unchanged
      result.push(ourLine);
    } else if (ourLine === baseLine) {
      // Only theirs changed
      result.push(theirLine);
    } else if (theirLine === baseLine) {
      // Only ours changed
      result.push(ourLine);
    } else {
      // Conflict!
      const conflictStartLine = result.length;
      result.push('<<<<<<< OURS');
      result.push(ourLine);
      result.push('=======');
      result.push(theirLine);
      result.push('>>>>>>> THEIRS');
      
      conflicts.push({
        start: conflictStartLine,
        end: result.length,
        ours: ourLine,
        theirs: theirLine,
      });
    }
    
    i++;
  }
  
  return { result: result.join('\n'), conflicts };
}

export const diffService = {
  computeDiff,
  formatUnifiedDiff,
  generateSideBySideHtml,
  computeWordDiff,
  threeWayMerge,
};

export default diffService;
