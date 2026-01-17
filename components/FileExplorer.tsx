import React, { useState } from 'react';
import { FileNode } from '../types';
import { useStore } from '../store/useStore';

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ files, onFileSelect }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const { createFile, createFolder, deleteNode, activeFileId, theme } = useStore();

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  };

  const handleNewFile = (parentPath: string) => {
    const name = prompt('Enter file name:');
    if (name) {
      createFile(parentPath, name);
    }
    setContextMenu(null);
  };

  const handleNewFolder = (parentPath: string) => {
    const name = prompt('Enter folder name:');
    if (name) {
      createFolder(parentPath, name);
    }
    setContextMenu(null);
  };

  const handleDelete = (path: string) => {
    if (confirm('Delete this item?')) {
      deleteNode(path);
    }
    setContextMenu(null);
  };

  const getFileIcon = (name: string, type: 'file' | 'folder'): string => {
    if (type === 'folder') return '📁';
    
    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      tsx: '⚛️',
      jsx: '⚛️',
      ts: '🔷',
      js: '🟨',
      py: '🐍',
      html: '🌐',
      css: '🎨',
      scss: '🎨',
      json: '📋',
      md: '📝',
      svg: '🖼️',
      png: '🖼️',
      jpg: '🖼️',
      gif: '🖼️',
      yaml: '⚙️',
      yml: '⚙️',
      env: '🔐',
      lock: '🔒',
      gitignore: '📦',
    };
    return iconMap[ext || ''] || '📄';
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isActive = node.id === activeFileId;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md transition-colors group
            ${isActive 
              ? 'bg-indigo-500/20 text-indigo-400' 
              : theme === 'dark' 
                ? 'hover:bg-slate-700/50 text-slate-300' 
                : 'hover:bg-gray-100 text-gray-700'}`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.path);
            } else {
              onFileSelect(node);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node.path)}
        >
          {node.type === 'folder' && (
            <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              ▶
            </span>
          )}
          <span className="text-sm">{getFileIcon(node.name, node.type)}</span>
          <span className="text-sm truncate flex-1">{node.name}</span>
        </div>

        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children
              .sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'folder' ? -1 : 1;
              })
              .map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-auto" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
        <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'} uppercase tracking-wider`}>
          Explorer
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => handleNewFile('')}
            className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
            title="New File"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => handleNewFolder('')}
            className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
            title="New Folder"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className="py-2">
        {files.length === 0 ? (
          <div className={`px-4 py-8 text-center ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'} text-sm`}>
            No files yet.<br />
            Create a project to get started.
          </div>
        ) : (
          files
            .sort((a, b) => {
              if (a.type === b.type) return a.name.localeCompare(b.name);
              return a.type === 'folder' ? -1 : 1;
            })
            .map((node) => renderNode(node))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={`fixed z-50 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border rounded-lg shadow-xl py-1 min-w-[160px]`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`w-full px-4 py-2 text-left text-sm ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'} flex items-center gap-2`}
            onClick={() => handleNewFile(contextMenu.path)}
          >
            <span>📄</span> New File
          </button>
          <button
            className={`w-full px-4 py-2 text-left text-sm ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-100'} flex items-center gap-2`}
            onClick={() => handleNewFolder(contextMenu.path)}
          >
            <span>📁</span> New Folder
          </button>
          <div className={`border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'} my-1`} />
          <button
            className={`w-full px-4 py-2 text-left text-sm text-red-400 ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100'} flex items-center gap-2`}
            onClick={() => handleDelete(contextMenu.path)}
          >
            <span>🗑️</span> Delete
          </button>
        </div>
      )}
    </div>
  );
};
