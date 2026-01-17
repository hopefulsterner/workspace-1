
import React from 'react';
import { AppConfig, ModelType } from '../types';
import { Icons } from '../constants';

interface ToolbarProps {
  app: AppConfig;
  onUpdate: (updates: Partial<AppConfig>) => void;
  isSaving: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isCameraActive: boolean;
  onToggleCamera: () => void;
  cameraResolution: string;
  onSetResolution: (res: any) => void;
  onSelectKey: () => void;
  hasKey: boolean;
  // Layout specific props
  layoutMode: string;
  onSetLayout: (mode: any) => void;
  deviceView: 'desktop' | 'mobile';
  onSetDevice: (device: 'desktop' | 'mobile') => void;
  isCodeMode: boolean;
  onToggleCode: () => void;
  // Theme props
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  app,
  onUpdate,
  isSaving,
  isOpen,
  onToggle,
  isCameraActive,
  onToggleCamera,
  cameraResolution,
  onSetResolution,
  onSelectKey,
  hasKey,
  layoutMode,
  onSetLayout,
  deviceView,
  onSetDevice,
  isCodeMode,
  onToggleCode,
  theme,
  onToggleTheme
}) => {
  return (
    <div className={`bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 h-screen flex flex-col shrink-0 transition-all duration-300 ${isOpen ? 'w-80' : 'w-16'}`}>
      {/* Header */}
      <div className={`p-4 border-b border-slate-100 dark:border-slate-700 flex items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
        <button onClick={onToggle} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400" title="Toggle Sidebar">
          <Icons.PanelLeft />
        </button>
        {isOpen && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Workspace Controls</span>
            <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
          </div>
        )}
      </div>

      <div className={`flex-1 overflow-y-auto ${isOpen ? 'p-6 space-y-8' : 'p-2 space-y-4'}`}>
        
        {/* THEME SWITCHER */}
        <section className="space-y-4">
          {isOpen && <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Appearance</h3>}
          <div className={`flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl ${!isOpen && 'flex-col'}`}>
            <button 
              onClick={() => theme === 'dark' && onToggleTheme()}
              className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${theme === 'light' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              title="Light Mode"
            >
              <Icons.Sun />
              {isOpen && "Light"}
            </button>
            <button 
              onClick={() => theme === 'light' && onToggleTheme()}
              className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${theme === 'dark' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              title="Dark Mode"
            >
              <Icons.Moon />
              {isOpen && "Dark"}
            </button>
          </div>
        </section>

        {/* VIEW & LAYOUT TOOLS */}
        <section className="space-y-4">
          {isOpen && <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">View & Layout</h3>}
          <div className="grid grid-cols-1 gap-2">
            
            {/* Split / Maximize Controls */}
            <div className={`flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl ${!isOpen && 'flex-col'}`}>
              <button 
                onClick={() => onSetLayout('split')}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${layoutMode === 'split' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                title="Split Window"
              >
                <Icons.LayoutSplit />
                {isOpen && "Split"}
              </button>
              <button 
                onClick={() => onSetLayout('preview-maximized')}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${layoutMode === 'preview-maximized' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                title="Full Screen Preview"
              >
                <Icons.Maximize />
                {isOpen && "Preview"}
              </button>
              <button 
                onClick={() => onSetLayout('editor-maximized')}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${layoutMode === 'editor-maximized' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                title="Full Screen Code"
              >
                <Icons.Columns />
                {isOpen && "Zen"}
              </button>
            </div>

            {/* Device Emulation */}
            <div className={`flex gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl ${!isOpen && 'flex-col'}`}>
              <button 
                onClick={() => onSetDevice('desktop')}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${deviceView === 'desktop' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                title="Desktop View"
              >
                <Icons.Monitor />
                {isOpen && "Desktop"}
              </button>
              <button 
                onClick={() => onSetDevice('mobile')}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${deviceView === 'mobile' ? 'bg-white dark:bg-slate-800 shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                title="Mobile View"
              >
                <Icons.Smartphone />
                {isOpen && "Mobile"}
              </button>
            </div>

            {/* Code Toggle */}
            <button 
              onClick={onToggleCode}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isCodeMode 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 border-indigo-500' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              } ${!isOpen && 'justify-center'}`}
            >
              <Icons.Code />
              {isOpen && <span className="text-xs font-bold flex-1 text-left">Code Preview</span>}
            </button>
          </div>
        </section>

        {/* AUTHENTICATION */}
        <section className="space-y-3">
          {isOpen && <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Hardware & Auth</h3>}
          <div className="space-y-2">
            <button 
              onClick={onSelectKey}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                !hasKey 
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-500 animate-pulse ring-2 ring-amber-100 dark:ring-amber-900/40' 
                  : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              } ${!isOpen && 'justify-center'}`}
            >
              <Icons.Settings />
              {isOpen && (
                <div className="flex-1 text-left">
                  <div className="text-xs font-bold">API Access</div>
                  <div className="text-[10px] opacity-70">{hasKey ? 'Key Active' : 'Select Key'}</div>
                </div>
              )}
            </button>

            <button 
              onClick={onToggleCamera}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${
                isCameraActive 
                  ? 'bg-emerald-600 text-white shadow-lg border-emerald-500' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              } ${!isOpen && 'justify-center'}`}
            >
              <Icons.Image />
              {isOpen && <span className="text-xs font-bold flex-1 text-left">Camera Stream</span>}
            </button>
          </div>
        </section>

        {/* MODEL PARAMS */}
        {isOpen && (
          <section className="space-y-6">
            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Intelligence Parameters</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Model Version</label>
                <select 
                  value={app.model}
                  onChange={(e) => onUpdate({ model: e.target.value as ModelType })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer dark:text-slate-200"
                >
                  <option value={ModelType.FLASH}>Gemini 3 Flash</option>
                  <option value={ModelType.PRO}>Gemini 3 Pro</option>
                </select>
              </div>

              <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                {[
                  { label: 'Temperature', key: 'temperature', min: 0, max: 2, step: 0.1 },
                  { label: 'Top P', key: 'topP', min: 0, max: 1, step: 0.01 },
                  { label: 'Max Output', key: 'maxOutputTokens', min: 128, max: 8192, step: 128 },
                ].map((param) => (
                  <div key={param.key} className="space-y-1">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{param.label}</label>
                      <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold">{app[param.key as keyof AppConfig]}</span>
                    </div>
                    <input 
                      type="range" min={param.min} max={param.max} step={param.step}
                      value={app[param.key as keyof AppConfig] as number}
                      onChange={(e) => onUpdate({ [param.key]: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* APP ICON */}
        <section className="space-y-4">
          {isOpen && <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Branding</h3>}
          {isOpen ? (
            <div className="grid grid-cols-4 gap-2">
              {['🤖', '💬', '🎨', '🚀', '📝', '📊', '🧠', '🔍', '⚙️', '🎵', '🕹️', '🎥'].map(emoji => (
                <button 
                  key={emoji}
                  onClick={() => onUpdate({ icon: emoji })}
                  className={`text-lg w-full aspect-square rounded-xl transition-all ${app.icon === emoji ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 scale-105 shadow-sm ring-1 ring-indigo-400' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
             <div className="flex justify-center text-2xl py-2">{app.icon}</div>
          )}
        </section>
      </div>

      {isOpen && (
        <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <button className="w-full bg-slate-900 dark:bg-slate-700 text-white py-3 rounded-xl text-xs font-bold hover:bg-black dark:hover:bg-slate-600 transition-all shadow-xl active:scale-95">
            Snapshot State
          </button>
        </div>
      )}
    </div>
  );
};
