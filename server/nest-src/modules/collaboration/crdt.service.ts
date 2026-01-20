import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { LoggerService } from '../../common/services/logger.service';

/**
 * CRDT (Conflict-free Replicated Data Type) Service
 * 
 * Provides high-level CRDT operations for collaborative editing.
 * Built on top of Yjs which implements CRDTs for text, arrays, maps, etc.
 */

export interface TextOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
}

export interface CursorPosition {
  line: number;
  column: number;
  offset: number;
}

export interface Selection {
  anchor: CursorPosition;
  head: CursorPosition;
}

export interface EditOperation {
  id: string;
  userId: string;
  timestamp: number;
  operations: TextOperation[];
  selection?: Selection;
}

@Injectable()
export class CrdtService {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('CrdtService');
  }

  // ============== Text Operations ==============

  /**
   * Apply text operations to a Yjs Text type
   */
  applyTextOperations(yText: Y.Text, operations: TextOperation[]): void {
    yText.doc?.transact(() => {
      let offset = 0;
      
      for (const op of operations) {
        switch (op.type) {
          case 'insert':
            yText.insert(op.position + offset, op.content || '');
            offset += (op.content?.length || 0);
            break;
          case 'delete':
            yText.delete(op.position + offset, op.length || 0);
            offset -= (op.length || 0);
            break;
          case 'retain':
            // Skip ahead - no change to offset
            break;
        }
      }
    });
  }

  /**
   * Convert Monaco Editor changes to CRDT operations
   */
  monacoChangesToOperations(changes: any[]): TextOperation[] {
    const operations: TextOperation[] = [];
    
    for (const change of changes) {
      // Handle deletion
      if (change.rangeLength > 0) {
        operations.push({
          type: 'delete',
          position: change.rangeOffset,
          length: change.rangeLength,
        });
      }
      
      // Handle insertion
      if (change.text.length > 0) {
        operations.push({
          type: 'insert',
          position: change.rangeOffset,
          content: change.text,
        });
      }
    }
    
    return operations;
  }

  /**
   * Convert CRDT operations to Monaco Editor changes
   */
  operationsToMonacoChanges(
    operations: TextOperation[],
    model: { getPositionAt: (offset: number) => any },
  ): any[] {
    const changes: any[] = [];
    
    for (const op of operations) {
      const startPosition = model.getPositionAt(op.position);
      
      switch (op.type) {
        case 'insert':
          changes.push({
            range: {
              startLineNumber: startPosition.lineNumber,
              startColumn: startPosition.column,
              endLineNumber: startPosition.lineNumber,
              endColumn: startPosition.column,
            },
            text: op.content || '',
          });
          break;
        case 'delete':
          const endPosition = model.getPositionAt(op.position + (op.length || 0));
          changes.push({
            range: {
              startLineNumber: startPosition.lineNumber,
              startColumn: startPosition.column,
              endLineNumber: endPosition.lineNumber,
              endColumn: endPosition.column,
            },
            text: '',
          });
          break;
      }
    }
    
    return changes;
  }

  // ============== Array Operations ==============

  /**
   * Insert items into a Yjs Array at a specific position
   */
  arrayInsert<T>(yArray: Y.Array<T>, index: number, items: T[]): void {
    yArray.doc?.transact(() => {
      yArray.insert(index, items);
    });
  }

  /**
   * Delete items from a Yjs Array
   */
  arrayDelete<T>(yArray: Y.Array<T>, index: number, length: number): void {
    yArray.doc?.transact(() => {
      yArray.delete(index, length);
    });
  }

  /**
   * Move an item in a Yjs Array
   */
  arrayMove<T>(yArray: Y.Array<T>, fromIndex: number, toIndex: number): void {
    yArray.doc?.transact(() => {
      const item = yArray.get(fromIndex);
      yArray.delete(fromIndex, 1);
      yArray.insert(toIndex, [item]);
    });
  }

  // ============== Map Operations ==============

  /**
   * Set a value in a Yjs Map
   */
  mapSet<T>(yMap: Y.Map<T>, key: string, value: T): void {
    yMap.doc?.transact(() => {
      yMap.set(key, value);
    });
  }

  /**
   * Delete a key from a Yjs Map
   */
  mapDelete<T>(yMap: Y.Map<T>, key: string): void {
    yMap.doc?.transact(() => {
      yMap.delete(key);
    });
  }

  /**
   * Batch update multiple keys in a Yjs Map
   */
  mapBatchUpdate<T>(yMap: Y.Map<T>, updates: Record<string, T>): void {
    yMap.doc?.transact(() => {
      for (const [key, value] of Object.entries(updates)) {
        yMap.set(key, value as T);
      }
    });
  }

  // ============== Operational Transform Helpers ==============

  /**
   * Transform operations against each other (for conflict resolution)
   * This is typically handled by Yjs internally, but useful for custom logic
   */
  transformOperations(
    op1: TextOperation[],
    op2: TextOperation[],
  ): { transformed1: TextOperation[]; transformed2: TextOperation[] } {
    // Simplified OT - Yjs handles this internally with CRDTs
    // This is provided for custom conflict resolution if needed
    return {
      transformed1: [...op1],
      transformed2: [...op2],
    };
  }

  // ============== Cursor/Selection Helpers ==============

  /**
   * Convert offset to line/column position
   */
  offsetToPosition(text: string, offset: number): CursorPosition {
    let line = 0;
    let column = 0;
    
    for (let i = 0; i < offset && i < text.length; i++) {
      if (text[i] === '\n') {
        line++;
        column = 0;
      } else {
        column++;
      }
    }
    
    return { line, column, offset };
  }

  /**
   * Convert line/column position to offset
   */
  positionToOffset(text: string, line: number, column: number): number {
    let currentLine = 0;
    let offset = 0;
    
    for (let i = 0; i < text.length; i++) {
      if (currentLine === line) {
        return offset + column;
      }
      if (text[i] === '\n') {
        currentLine++;
      }
      offset++;
    }
    
    return offset + column;
  }

  /**
   * Transform a cursor position after text operations
   */
  transformCursorPosition(
    cursor: CursorPosition,
    operations: TextOperation[],
  ): CursorPosition {
    let newOffset = cursor.offset;
    
    for (const op of operations) {
      if (op.type === 'insert' && op.position <= cursor.offset) {
        newOffset += op.content?.length || 0;
      } else if (op.type === 'delete' && op.position < cursor.offset) {
        const deleteEnd = op.position + (op.length || 0);
        if (deleteEnd <= cursor.offset) {
          newOffset -= op.length || 0;
        } else {
          newOffset = op.position;
        }
      }
    }
    
    // Note: line/column would need to be recalculated from the new text
    return { ...cursor, offset: newOffset };
  }

  // ============== Undo/Redo Support ==============

  /**
   * Create an undo manager for a Yjs document
   */
  createUndoManager(doc: Y.Doc, trackedTypes: (Y.Text | Y.Array<any> | Y.Map<any>)[]): Y.UndoManager {
    return new Y.UndoManager(trackedTypes, {
      trackedOrigins: new Set([doc.clientID]),
    });
  }

  // ============== Diff Operations ==============

  /**
   * Calculate diff between two strings as CRDT operations
   */
  calculateDiff(oldText: string, newText: string): TextOperation[] {
    const operations: TextOperation[] = [];
    
    // Simple diff algorithm - find common prefix and suffix
    let commonPrefixLength = 0;
    while (
      commonPrefixLength < oldText.length &&
      commonPrefixLength < newText.length &&
      oldText[commonPrefixLength] === newText[commonPrefixLength]
    ) {
      commonPrefixLength++;
    }
    
    let commonSuffixLength = 0;
    while (
      commonSuffixLength < oldText.length - commonPrefixLength &&
      commonSuffixLength < newText.length - commonPrefixLength &&
      oldText[oldText.length - 1 - commonSuffixLength] ===
        newText[newText.length - 1 - commonSuffixLength]
    ) {
      commonSuffixLength++;
    }
    
    const deleteLength = oldText.length - commonPrefixLength - commonSuffixLength;
    const insertText = newText.substring(
      commonPrefixLength,
      newText.length - commonSuffixLength,
    );
    
    if (deleteLength > 0) {
      operations.push({
        type: 'delete',
        position: commonPrefixLength,
        length: deleteLength,
      });
    }
    
    if (insertText.length > 0) {
      operations.push({
        type: 'insert',
        position: commonPrefixLength,
        content: insertText,
      });
    }
    
    return operations;
  }

  // ============== Merge Operations ==============

  /**
   * Merge two document states (for conflict resolution)
   * Returns the merged state as a Uint8Array
   */
  mergeStates(state1: Uint8Array, state2: Uint8Array): Uint8Array {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state1);
    Y.applyUpdate(doc, state2);
    return Y.encodeStateAsUpdate(doc);
  }

  /**
   * Get state vector for a document (for efficient sync)
   */
  getStateVector(doc: Y.Doc): Uint8Array {
    return Y.encodeStateVector(doc);
  }

  /**
   * Get missing updates based on state vector
   */
  getMissingUpdates(doc: Y.Doc, stateVector: Uint8Array): Uint8Array {
    return Y.encodeStateAsUpdate(doc, stateVector);
  }
}
