import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { useStore } from '../store/useStore';

interface CodeEditorProps {
  className?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ className = '' }) => {
  const { openFiles, activeFileId, updateFileContent, closeFile, setActiveFile, theme, editorSettings } = useStore();
  const editorRef = useRef<any>(null);

  const activeFile = openFiles.find(f => f.id === activeFileId);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleEditorChange: OnChange = (value) => {
    if (activeFileId && value !== undefined) {
      updateFileContent(activeFileId, value);
    }
  };

  // Update editor options in real-time when settings change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        minimap: { enabled: editorSettings.minimap },
        fontSize: editorSettings.fontSize,
        lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
        wordWrap: editorSettings.wordWrap ? 'on' : 'off',
        tabSize: editorSettings.tabSize,
      });
    }
  }, [editorSettings.minimap, editorSettings.fontSize, editorSettings.lineNumbers, editorSettings.wordWrap, editorSettings.tabSize]);

  useEffect(() => {
    if (editorRef.current && activeFile) {
      editorRef.current.focus();
    }
  }, [activeFileId]);

  const getFileIcon = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      tsx: '⚛️',
      jsx: '⚛️',
      ts: '🔷',
      js: '🟨',
      py: '🐍',
      html: '🌐',
      css: '🎨',
      json: '📋',
      md: '📝',
    };
    return iconMap[ext || ''] || '📄';
  };

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'} ${className}`}>
      {/* Tabs */}
      <div className={`flex items-center ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'} border-b overflow-x-auto`}>
        {openFiles.map((file) => (
          <div
            key={file.id}
            className={`flex items-center gap-2 px-4 py-2 border-r cursor-pointer min-w-fit
              ${file.id === activeFileId 
                ? theme === 'dark' 
                  ? 'bg-slate-900 text-white border-slate-700 border-t-2 border-t-indigo-500' 
                  : 'bg-white text-gray-900 border-gray-200 border-t-2 border-t-indigo-500'
                : theme === 'dark'
                  ? 'text-slate-400 hover:bg-slate-700/50 border-slate-700'
                  : 'text-gray-600 hover:bg-gray-100 border-gray-200'}`}
            onClick={() => setActiveFile(file.id)}
          >
            <span className="text-sm">{getFileIcon(file.name)}</span>
            <span className="text-sm whitespace-nowrap">{file.name}</span>
            {file.isDirty && <span className="w-2 h-2 rounded-full bg-orange-400" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.id);
              }}
              className={`ml-2 p-0.5 rounded ${theme === 'dark' ? 'hover:bg-slate-600 text-slate-500 hover:text-slate-200' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {openFiles.length === 0 && (
          <div className={`px-4 py-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'} text-sm`}>
            No files open
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1">
        {activeFile ? (
          <Editor
            height="100%"
            language={activeFile.language}
            value={activeFile.content}
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: editorSettings.minimap },
              fontSize: editorSettings.fontSize,
              fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
              fontLigatures: true,
              lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
              wordWrap: editorSettings.wordWrap ? 'on' : 'off',
              automaticLayout: true,
              tabSize: editorSettings.tabSize,
              scrollBeyondLastLine: false,
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              padding: { top: 16 },
            }}
          />
        ) : (
          <div className={`h-full flex items-center justify-center ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            <div className="text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'} mb-2`}>AI Digital Friend Zone</h2>
              <p className="text-sm">Select a file to start editing</p>
              <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`}>or create a new project from templates</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
