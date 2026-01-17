
import React, { useState, useEffect, useRef } from 'react';
import { AppConfig, ModelType } from '../types';
import { Icons } from '../constants';
import { architectApp } from '../services/gemini';

interface EditorProps {
  app: AppConfig;
  onUpdate: (updates: Partial<AppConfig>) => void;
  isSaving: boolean;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  isCodeMode: boolean;
}

type VirtualFile = 'instructions.prompt' | 'manifest.json' | 'engine.json';

export const Editor: React.FC<EditorProps> = ({ 
  app, 
  onUpdate, 
  isSaving, 
  isMaximized, 
  onToggleMaximize,
  isCodeMode
}) => {
  const [activeFile, setActiveFile] = useState<VirtualFile>('instructions.prompt');
  const [isArchitecting, setIsArchitecting] = useState(false);
  const [architectPrompt, setArchitectPrompt] = useState('');
  const [showToast, setShowToast] = useState(false);
  const prevIsSaving = useRef(isSaving);

  // File tree structure
  const files = [
    { name: 'instructions.prompt', icon: '📝', type: 'prompt' },
    { name: 'manifest.json', icon: '📄', type: 'json' },
    { name: 'engine.json', icon: '⚙️', type: 'json' },
  ];

  useEffect(() => {
    if (prevIsSaving.current === true && isSaving === false) {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
    prevIsSaving.current = isSaving;
  }, [isSaving]);

  const handleArchitect = async () => {
    if (!architectPrompt.trim()) return;
    setIsArchitecting(true);
    try {
      const updates = await architectApp(architectPrompt, app);
      onUpdate(updates);
      setArchitectPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsArchitecting(false);
    }
  };

  const getFileContent = () => {
    switch(activeFile) {
      case 'manifest.json':
        return JSON.stringify({
          name: app.name,
          description: app.description,
          icon: app.icon
        }, null, 2);
      case 'engine.json':
        return JSON.stringify({
          model: app.model,
          parameters: {
            temperature: app.temperature,
            topP: app.topP,
            maxTokens: app.maxOutputTokens
          }
        }, null, 2);
      default:
        return app.systemInstruction;
    }
  };

  const handleContentUpdate = (content: string) => {
    try {
      if (activeFile === 'manifest.json') {
        const parsed = JSON.parse(content);
        onUpdate({ name: parsed.name, description: parsed.description, icon: parsed.icon });
      } else if (activeFile === 'engine.json') {
        const parsed = JSON.parse(content);
        onUpdate({ 
          model: parsed.model as ModelType, 
          temperature: parsed.parameters.temperature,
          topP: parsed.parameters.topP,
          maxOutputTokens: parsed.parameters.maxTokens
        });
      } else {
        onUpdate({ systemInstruction: content });
      }
    } catch (e) {
      // Silently fail on invalid JSON during typing
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative overflow-hidden transition-all duration-500">
      {/* Save Toast */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 pointer-events-none ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-slate-900 dark:bg-slate-800 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 border border-slate-700">
          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span className="text-sm font-medium">Changes synced</span>
        </div>
      </div>

      {/* Main Workspace Header */}
      <header className="h-14 px-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0 transition-colors">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded text-lg">{app.icon}</div>
            <h1 className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{app.name}</h1>
          </div>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <input 
              type="text"
              value={architectPrompt}
              onChange={(e) => setArchitectPrompt(e.target.value)}
              placeholder="Architect: Describe app behavior..."
              className="w-80 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-200"
              onKeyDown={(e) => e.key === 'Enter' && handleArchitect()}
            />
            <button 
              onClick={handleArchitect}
              disabled={isArchitecting}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
            >
              {isArchitecting ? 'Refactoring...' : 'Refactor'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 transition-opacity duration-300 ${isSaving ? 'opacity-100' : 'opacity-0'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase">Saving</span>
          </div>
          <button onClick={onToggleMaximize} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
            {isMaximized ? <Icons.LayoutSplit /> : <Icons.Maximize />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer Sidebar */}
        <aside className="w-64 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 flex flex-col shrink-0 transition-colors">
          <div className="p-3 flex items-center justify-between text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Icons.ChevronRight />
              <span className="text-[10px] font-bold uppercase tracking-wider">File Explorer</span>
            </div>
            <div className="flex gap-2">
              <button className="hover:text-slate-800 dark:hover:text-slate-200"><Icons.Plus /></button>
              <button className="hover:text-slate-800 dark:hover:text-slate-200"><Icons.Search /></button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            <div>
              <div className="flex items-center gap-2 px-2 py-1 text-slate-400 dark:text-slate-500">
                <Icons.ChevronRight />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">src</span>
              </div>
              <div className="ml-4 space-y-0.5 mt-1">
                {files.map(file => (
                  <button
                    key={file.name}
                    onClick={() => setActiveFile(file.name as VirtualFile)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors ${activeFile === file.name ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
                  >
                    <span className="text-base">{file.icon}</span>
                    <span className="truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Editor Main View */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden transition-colors">
          {/* Tabs Bar */}
          <div className="h-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-1 shrink-0 overflow-x-auto">
            {files.map(file => (
              <button
                key={file.name}
                onClick={() => setActiveFile(file.name as VirtualFile)}
                className={`h-full px-4 flex items-center gap-2 text-xs border-r border-slate-200 dark:border-slate-700 transition-all ${activeFile === file.name ? 'bg-white dark:bg-slate-800 border-t-2 border-t-indigo-500 text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
              >
                <span>{file.icon}</span>
                {file.name}
                {activeFile === file.name && <div className="ml-2 w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-600" />}
              </button>
            ))}
          </div>

          {/* Breadcrumbs */}
          <div className="h-8 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center px-4 gap-2 text-[10px] text-slate-400 shrink-0">
            <span>src</span>
            <Icons.ChevronRight />
            <span className="text-slate-600 dark:text-slate-300 font-medium">{activeFile}</span>
          </div>

          {/* Code Canvas */}
          <div className="flex-1 relative overflow-hidden bg-white dark:bg-slate-950 transition-colors">
            <div className="absolute inset-0 flex">
              {/* Line Numbers */}
              <div className="w-12 bg-slate-50 dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 text-[10px] text-slate-300 dark:text-slate-600 font-mono py-4 text-right pr-3 select-none transition-colors">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="h-6">{i + 1}</div>
                ))}
              </div>
              
              {/* Editor Content */}
              <textarea
                value={getFileContent()}
                onChange={(e) => handleContentUpdate(e.target.value)}
                spellCheck={false}
                className={`flex-1 p-4 font-mono text-sm leading-6 outline-none bg-transparent resize-none h-full transition-all ${activeFile.endsWith('.json') ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}
                placeholder="// Start writing your agent logic here..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
