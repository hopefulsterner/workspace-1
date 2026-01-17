import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useStore } from './store/useStore';
import { FileExplorer } from './components/FileExplorer';
import { CodeEditor } from './components/CodeEditor';
import { AIChat } from './components/AIChat';
import { AgenticAIChat } from './components/AgenticAIChat';
import { TemplateGallery } from './components/TemplateGallery';
import { LivePreview } from './components/LivePreview';
import { DeployPanel } from './components/DeployPanel';
import { ExtensionsPanel } from './components/ExtensionsPanel';
import { FileNode, OpenFile } from './types';
import { voiceOutput, speechSupport } from './services/speech';
import { mediaService } from './services/media';

type LeftTab = 'files' | 'templates' | 'extensions' | 'search' | 'history';
type RightTab = 'ai' | 'deploy' | 'settings';

// AI Provider Models Configuration
const AI_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    icon: '✨',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
  },
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🧠',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'],
  },
  mistral: {
    name: 'Mistral AI',
    icon: '🌀',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest', 'pixtral-12b-2409'],
  },
  groq: {
    name: 'Groq',
    icon: '⚡',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
  xai: {
    name: 'xAI',
    icon: '🅧',
    models: ['grok-2', 'grok-2-mini', 'grok-beta'],
  },
  cerebras: {
    name: 'Cerebras',
    icon: '🔮',
    models: ['llama3.1-8b', 'llama3.1-70b'],
  },
  huggingface: {
    name: 'Hugging Face',
    icon: '🤗',
    models: ['meta-llama/Llama-3.2-3B-Instruct', 'mistralai/Mistral-7B-Instruct-v0.3', 'Qwen/Qwen2.5-72B-Instruct'],
  },
  ollama: {
    name: 'Ollama (Local)',
    icon: '🦙',
    models: ['llama3.2', 'mistral', 'codellama', 'deepseek-coder', 'qwen2.5-coder'],
  },
};

type AIProviderKey = keyof typeof AI_PROVIDERS;

// History Panel Component
const HistoryPanel: React.FC = () => {
  const { projects, currentProject, setCurrentProject, setFiles, deleteProject, renameProject, theme } = useStore();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renameMode, setRenameMode] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setMenuOpen(null);
    if (menuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [menuOpen]);
  
  const bgCard = theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50';
  const bgCardHover = theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-100';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-slate-300' : 'text-gray-600';
  const textMuted = theme === 'dark' ? 'text-slate-400' : 'text-gray-500';
  const borderColor = theme === 'dark' ? 'border-slate-700' : 'border-gray-200';

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTemplateIcon = (template: string) => {
    const icons: Record<string, string> = {
      'react': '⚛️',
      'vue': '💚',
      'next': '▲',
      'node': '🟢',
      'python': '🐍',
      'html': '🌐',
      'typescript': '🔷',
    };
    return icons[template.toLowerCase()] || '📁';
  };

  const handleOpenProject = (project: typeof projects[0]) => {
    setCurrentProject(project);
    setFiles(project.files);
  };

  const handleRename = (projectId: string, currentName: string) => {
    setRenameMode(projectId);
    setRenameValue(currentName);
    setMenuOpen(null);
  };

  const handleRenameSubmit = (projectId: string) => {
    if (renameValue.trim()) {
      renameProject(projectId, renameValue.trim());
    }
    setRenameMode(null);
    setRenameValue('');
  };

  const handleDelete = (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject(projectId);
    }
    setMenuOpen(null);
  };

  const handleDownload = (project: typeof projects[0]) => {
    // Create a JSON file with project data
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportName = `${project.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
    setMenuOpen(null);
  };

  const handleShare = (project: typeof projects[0]) => {
    // Copy project info to clipboard
    const shareText = `Check out my project: ${project.name} (${project.template}) - ${project.files.length} files`;
    navigator.clipboard.writeText(shareText);
    alert('Project info copied to clipboard!');
    setMenuOpen(null);
  };

  const menuBg = theme === 'dark' ? 'bg-slate-700' : 'bg-white';
  const menuHover = theme === 'dark' ? 'hover:bg-slate-600' : 'hover:bg-gray-100';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${borderColor}`}>
        <h3 className={`text-sm font-semibold ${textPrimary}`}>Project History</h3>
        <p className={`text-xs ${textMuted} mt-1`}>{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-auto p-2">
        {projects.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📭</div>
            <p className={`text-sm ${textMuted}`}>No projects yet</p>
            <p className={`text-xs ${textMuted} mt-1`}>Create a new project from templates</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...projects].reverse().map((project) => (
              <div
                key={project.id}
                className={`relative w-full text-left p-3 rounded-lg transition-all duration-200 ${bgCard} border ${borderColor} ${
                  currentProject?.id === project.id 
                    ? 'ring-2 ring-indigo-500 border-indigo-500' 
                    : ''
                }`}
              >
                <div 
                  className={`flex items-start gap-3 cursor-pointer ${bgCardHover} rounded -m-3 p-3`}
                  onClick={() => handleOpenProject(project)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                    theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
                  }`}>
                    {getTemplateIcon(project.template)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {renameMode === project.id ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRenameSubmit(project.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit(project.id);
                          if (e.key === 'Escape') { setRenameMode(null); setRenameValue(''); }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className={`w-full px-2 py-1 text-sm rounded ${theme === 'dark' ? 'bg-slate-600 text-white' : 'bg-white text-gray-900 border'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium truncate ${textPrimary}`}>{project.name}</h4>
                        {currentProject?.id === project.id && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">Active</span>
                        )}
                      </div>
                    )}
                    <p className={`text-xs ${textMuted} truncate`}>{project.template}</p>
                    <div className={`flex items-center gap-2 mt-1 text-xs ${textMuted}`}>
                      <span>{project.files.length} files</span>
                      <span>•</span>
                      <span>{formatDate(project.updatedAt)}</span>
                    </div>
                  </div>
                  
                  {/* Hamburger Menu Button */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === project.id ? null : project.id);
                      }}
                      className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-gray-200 text-gray-500'}`}
                      title="More options"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    {menuOpen === project.id && (
                      <div className={`absolute right-0 top-8 w-36 ${menuBg} rounded-lg shadow-lg border ${borderColor} z-50 overflow-hidden`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenProject(project); setMenuOpen(null); }}
                          className={`w-full px-3 py-2 text-left text-sm ${textPrimary} ${menuHover} flex items-center gap-2`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Open
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRename(project.id, project.name); }}
                          className={`w-full px-3 py-2 text-left text-sm ${textPrimary} ${menuHover} flex items-center gap-2`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Rename
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(project); }}
                          className={`w-full px-3 py-2 text-left text-sm ${textPrimary} ${menuHover} flex items-center gap-2`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleShare(project); }}
                          className={`w-full px-3 py-2 text-left text-sm ${textPrimary} ${menuHover} flex items-center gap-2`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share
                        </button>
                        <div className={`border-t ${borderColor}`} />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                          className={`w-full px-3 py-2 text-left text-sm text-red-500 ${menuHover} flex items-center gap-2`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {projects.length > 0 && (
        <div className={`p-3 border-t ${borderColor}`}>
          <div className={`grid grid-cols-2 gap-2 text-center`}>
            <div className={`p-2 rounded-lg ${bgCard}`}>
              <div className={`text-lg font-bold ${textPrimary}`}>{projects.length}</div>
              <div className={`text-xs ${textMuted}`}>Projects</div>
            </div>
            <div className={`p-2 rounded-lg ${bgCard}`}>
              <div className={`text-lg font-bold ${textPrimary}`}>
                {projects.reduce((acc, p) => acc + p.files.length, 0)}
              </div>
              <div className={`text-xs ${textMuted}`}>Total Files</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Settings Panel Component
const SettingsPanel: React.FC<{ theme: string; setTheme: (t: any) => void }> = ({ theme, setTheme }) => {
  const { editorSettings, setEditorSettings, aiConfig, setAiConfig } = useStore();
  
  const bgCard = theme === 'dark' ? 'bg-slate-800' : 'bg-gray-50';
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-slate-300' : 'text-gray-700';
  const textMuted = theme === 'dark' ? 'text-slate-400' : 'text-gray-500';
  const borderColor = theme === 'dark' ? 'border-slate-700' : 'border-gray-200';
  const inputBg = theme === 'dark' ? 'bg-slate-700' : 'bg-white border border-gray-300';
  const kbdBg = theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200';

  const currentProvider = AI_PROVIDERS[aiConfig.provider as AIProviderKey] || AI_PROVIDERS.gemini;

  return (
    <div className="p-4 space-y-6 overflow-auto h-full">
      {/* Appearance */}
      <div>
        <h3 className={`text-sm font-semibold ${textPrimary} mb-3`}>Appearance</h3>
        <div className="space-y-2">
          <div className={`flex items-center justify-between p-3 ${bgCard} rounded-lg`}>
            <span className={`text-sm ${textSecondary}`}>Theme</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              title="Select theme"
              className={`${inputBg} ${textPrimary} text-sm px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
      </div>

      {/* Editor Settings */}
      <div>
        <h3 className={`text-sm font-semibold ${textPrimary} mb-3`}>Editor</h3>
        <div className="space-y-2">
          <div className={`flex items-center justify-between p-3 ${bgCard} rounded-lg`}>
            <span className={`text-sm ${textSecondary}`}>Font Size</span>
            <select
              value={editorSettings.fontSize}
              onChange={(e) => setEditorSettings({ fontSize: Number(e.target.value) })}
              className={`${inputBg} ${textPrimary} text-sm px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
              {[10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24].map(size => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>
          </div>
          <div className={`flex items-center justify-between p-3 ${bgCard} rounded-lg`}>
            <span className={`text-sm ${textSecondary}`}>Tab Size</span>
            <select
              value={editorSettings.tabSize}
              onChange={(e) => setEditorSettings({ tabSize: Number(e.target.value) })}
              className={`${inputBg} ${textPrimary} text-sm px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value={8}>8 spaces</option>
            </select>
          </div>
          <div className={`flex items-center justify-between p-3 ${bgCard} rounded-lg`}>
            <span className={`text-sm ${textSecondary}`}>Word Wrap</span>
            <button
              onClick={() => setEditorSettings({ wordWrap: !editorSettings.wordWrap })}
              className={`text-sm px-3 py-1 rounded transition-colors ${
                editorSettings.wordWrap
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : `${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-200'} ${textMuted}`
              }`}
            >
              {editorSettings.wordWrap ? 'On' : 'Off'}
            </button>
          </div>
          <div className={`flex items-center justify-between p-3 ${bgCard} rounded-lg`}>
            <span className={`text-sm ${textSecondary}`}>Minimap</span>
            <button
              onClick={() => setEditorSettings({ minimap: !editorSettings.minimap })}
              className={`text-sm px-3 py-1 rounded transition-colors ${
                editorSettings.minimap
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : `${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-200'} ${textMuted}`
              }`}
            >
              {editorSettings.minimap ? 'On' : 'Off'}
            </button>
          </div>
          <div className={`flex items-center justify-between p-3 ${bgCard} rounded-lg`}>
            <span className={`text-sm ${textSecondary}`}>Line Numbers</span>
            <button
              onClick={() => setEditorSettings({ lineNumbers: !editorSettings.lineNumbers })}
              className={`text-sm px-3 py-1 rounded transition-colors ${
                editorSettings.lineNumbers
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : `${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-200'} ${textMuted}`
              }`}
            >
              {editorSettings.lineNumbers ? 'On' : 'Off'}
            </button>
          </div>
          <div className={`flex items-center justify-between p-3 ${bgCard} rounded-lg`}>
            <span className={`text-sm ${textSecondary}`}>Auto Save</span>
            <button
              onClick={() => setEditorSettings({ autoSave: !editorSettings.autoSave })}
              className={`text-sm px-3 py-1 rounded transition-colors ${
                editorSettings.autoSave
                  ? 'bg-emerald-500/20 text-emerald-500'
                  : `${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-200'} ${textMuted}`
              }`}
            >
              {editorSettings.autoSave ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <div>
        <h3 className={`text-sm font-semibold ${textPrimary} mb-3`}>AI Assistant</h3>
        <div className="space-y-2">
          <div className={`p-3 ${bgCard} rounded-lg space-y-2`}>
            <span className={`text-sm ${textSecondary} block mb-2`}>Provider</span>
            <select
              value={aiConfig.provider}
              onChange={(e) => {
                const provider = e.target.value as AIProviderKey;
                const models = AI_PROVIDERS[provider]?.models || [];
                setAiConfig({ 
                  provider: provider as any, 
                  model: models[0] || '' 
                });
              }}
              className={`w-full ${inputBg} ${textPrimary} text-sm px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
              {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                <option key={key} value={key}>
                  {provider.icon} {provider.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className={`p-3 ${bgCard} rounded-lg space-y-2`}>
            <span className={`text-sm ${textSecondary} block mb-2`}>Model</span>
            <select
              value={aiConfig.model}
              onChange={(e) => setAiConfig({ model: e.target.value })}
              className={`w-full ${inputBg} ${textPrimary} text-sm px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
              {currentProvider.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <div className={`p-3 ${bgCard} rounded-lg space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${textSecondary}`}>Temperature</span>
              <span className={`text-sm ${textMuted}`}>{aiConfig.temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={aiConfig.temperature}
              onChange={(e) => setAiConfig({ temperature: Number(e.target.value) })}
              className="w-full accent-indigo-500"
            />
            <div className={`flex justify-between text-xs ${textMuted}`}>
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          <div className={`p-3 ${bgCard} rounded-lg space-y-2`}>
            <span className={`text-sm ${textSecondary} block mb-2`}>Max Tokens</span>
            <select
              value={aiConfig.maxTokens}
              onChange={(e) => setAiConfig({ maxTokens: Number(e.target.value) })}
              className={`w-full ${inputBg} ${textPrimary} text-sm px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            >
              <option value={1024}>1,024</option>
              <option value={2048}>2,048</option>
              <option value={4096}>4,096</option>
              <option value={8192}>8,192</option>
              <option value={16384}>16,384</option>
              <option value={32768}>32,768</option>
            </select>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div>
        <h3 className={`text-sm font-semibold ${textPrimary} mb-3`}>Keyboard Shortcuts</h3>
        <div className="space-y-1 text-xs">
          <div className={`flex justify-between p-2 ${textMuted}`}>
            <span>Open File</span>
            <kbd className={`px-2 py-0.5 ${kbdBg} rounded`}>Ctrl+O</kbd>
          </div>
          <div className={`flex justify-between p-2 ${textMuted}`}>
            <span>Save File</span>
            <kbd className={`px-2 py-0.5 ${kbdBg} rounded`}>Ctrl+S</kbd>
          </div>
          <div className={`flex justify-between p-2 ${textMuted}`}>
            <span>AI Assistant</span>
            <kbd className={`px-2 py-0.5 ${kbdBg} rounded`}>Ctrl+Shift+A</kbd>
          </div>
        </div>
      </div>

      {/* Reset Settings */}
      <div>
        <button
          onClick={() => {
            setEditorSettings({
              fontSize: 14,
              tabSize: 2,
              wordWrap: true,
              minimap: true,
              lineNumbers: true,
              autoSave: true,
            });
            setAiConfig({
              provider: 'gemini',
              model: 'gemini-2.0-flash',
              temperature: 0.7,
              maxTokens: 4096,
            });
          }}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            theme === 'dark' 
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
        >
          Reset to Defaults
        </button>
      </div>

      <div className={`pt-4 border-t ${borderColor}`}>
        <p className={`text-xs ${textMuted} text-center`}>
          AI Digital Friend Zone v1.0.0
        </p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const {
    files,
    openFile,
    theme,
    setTheme,
    currentProject,
    addMessage,
  } = useStore();

  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  
  // Voice, Screenshot, Camera state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Voice toggle handler
  const handleVoiceToggle = useCallback(() => {
    if (voiceEnabled) {
      voiceOutput.stop();
      setVoiceEnabled(false);
    } else {
      setVoiceEnabled(true);
    }
  }, [voiceEnabled]);
  
  // Screenshot handler - uses browser's native screen capture API
  const handleScreenshot = useCallback(async () => {
    setIsCapturing(true);
    try {
      // Use the browser's native screen capture API
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
        },
        audio: false,
      });
      
      // Get the video track
      const track = mediaStream.getVideoTracks()[0];
      
      // Create an ImageCapture object
      const imageCapture = new (window as any).ImageCapture(track);
      
      // Grab a frame
      const bitmap = await imageCapture.grabFrame();
      
      // Stop the stream immediately after capture
      track.stop();
      
      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        
        const filename = `screenshot-${currentProject?.name || 'project'}-${Date.now()}.png`;
        
        // Upload to S3
        const uploadResult = await mediaService.uploadFromCanvas(
          canvas, 
          filename, 
          'SCREENSHOT',
          currentProject?.id
        );
        
        if (uploadResult.success && uploadResult.media) {
          // Add to chat with S3 URL
          addMessage({
            id: crypto.randomUUID(),
            role: 'user',
            content: `📸 Screenshot captured and uploaded!\n\n![Screenshot](${uploadResult.media.url})`,
            timestamp: Date.now(),
          });
          
          // Also download locally
          mediaService.download(uploadResult.media.url, filename);
        } else {
          // Fallback: just download locally
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              
              addMessage({
                id: crypto.randomUUID(),
                role: 'user',
                content: '📸 Screenshot captured and saved locally!',
                timestamp: Date.now(),
              });
            }
          }, 'image/png');
        }
      }
    } catch (error: any) {
      console.error('Screenshot error:', error);
      if (error.name !== 'AbortError') {
        alert('Failed to capture screenshot. Please allow screen sharing when prompted.');
      }
    } finally {
      setIsCapturing(false);
    }
  }, [currentProject, addMessage]);
  
  // Camera handler
  const handleCameraToggle = useCallback(async () => {
    if (cameraActive && cameraStream) {
      // Stop camera
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setCameraActive(false);
    } else {
      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          } 
        });
        setCameraStream(stream);
        setCameraActive(true);
        // Video will be connected in useEffect when modal opens
      } catch (error: any) {
        console.error('Camera error:', error);
        if (error.name === 'NotAllowedError') {
          alert('Camera access denied. Please allow camera permissions in your browser settings.');
        } else if (error.name === 'NotFoundError') {
          alert('No camera found on this device.');
        } else {
          alert('Failed to access camera. Please check permissions.');
        }
      }
    }
  }, [cameraActive, cameraStream]);
  
  // Capture photo from camera
  const capturePhoto = useCallback(async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        const filename = `camera-${Date.now()}.png`;
        
        // Upload to S3
        const uploadResult = await mediaService.uploadFromCanvas(
          canvas,
          filename,
          'CAMERA',
          currentProject?.id
        );
        
        if (uploadResult.success && uploadResult.media) {
          // Add to chat with S3 URL
          addMessage({
            id: crypto.randomUUID(),
            role: 'user',
            content: `📷 Photo captured!\n\n![Camera Photo](${uploadResult.media.url})`,
            timestamp: Date.now(),
          });
          
          // Also download locally
          mediaService.download(uploadResult.media.url, filename);
        } else {
          // Fallback: just download locally
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename;
              a.click();
              URL.revokeObjectURL(url);
              
              addMessage({
                id: crypto.randomUUID(),
                role: 'user',
                content: '📷 Photo captured and saved locally!',
                timestamp: Date.now(),
              });
            }
          }, 'image/png');
        }
      }
    }
  }, [addMessage, currentProject]);
  
  // Connect camera stream to video element when stream or cameraActive changes
  useEffect(() => {
    if (cameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraActive, cameraStream]);
  
  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTab>('files');
  const [rightTab, setRightTab] = useState<RightTab>('ai');
  const [viewMode, setViewMode] = useState<'code' | 'split' | 'preview'>('code');

  // Sync theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleFileSelect = (node: FileNode) => {
    if (node.type === 'file') {
      const file: OpenFile = {
        id: node.id,
        name: node.name,
        path: node.path,
        content: node.content || '',
        language: node.language || 'plaintext',
        isDirty: false,
      };
      openFile(file);
    }
  };

  // Left sidebar items
  const leftSidebarItems = [
    { id: 'files' as LeftTab, icon: '📁', label: 'Explorer', tooltip: 'File Explorer (Ctrl+Shift+E)' },
    { id: 'search' as LeftTab, icon: '🔍', label: 'Search', tooltip: 'Search (Ctrl+Shift+F)' },
    { id: 'templates' as LeftTab, icon: '📋', label: 'Templates', tooltip: 'Project Templates' },
    { id: 'extensions' as LeftTab, icon: '🧩', label: 'Extensions', tooltip: 'Extensions (Ctrl+Shift+X)' },
    { id: 'history' as LeftTab, icon: '📜', label: 'History', tooltip: 'Project History (Ctrl+H)' },
  ];

  // Right sidebar items
  const rightSidebarItems = [
    { id: 'ai' as RightTab, icon: '🤖', label: 'AI Chat', tooltip: 'AI Assistant (Ctrl+Shift+A)' },
    { id: 'deploy' as RightTab, icon: '🚀', label: 'Deploy', tooltip: 'Deploy to Cloud' },
    { id: 'settings' as RightTab, icon: '⚙️', label: 'Settings', tooltip: 'Settings (Ctrl+,)' },
  ];

  // Theme classes - Light mode should be WHITE
  const themeClasses = theme === 'dark' 
    ? 'bg-slate-900 text-white' 
    : 'bg-white text-gray-900';
  
  const sidebarClasses = theme === 'dark'
    ? 'bg-slate-900 border-slate-800'
    : 'bg-gray-50 border-gray-200';
  
  const panelClasses = theme === 'dark'
    ? 'bg-slate-800 border-slate-700'
    : 'bg-white border-gray-200';
  
  const headerClasses = theme === 'dark'
    ? 'bg-slate-800/50 border-slate-700'
    : 'bg-white border-gray-200';
  
  const iconBarBtnActive = theme === 'dark'
    ? 'bg-slate-800 text-white'
    : 'bg-white text-gray-900 shadow-sm';
  
  const iconBarBtnInactive = theme === 'dark'
    ? 'text-slate-500 hover:text-white hover:bg-slate-800/50'
    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200';
  
  const tooltipClasses = theme === 'dark'
    ? 'bg-slate-700 text-white'
    : 'bg-gray-800 text-white';

  return (
    <div className={`flex h-screen w-full overflow-hidden font-sans ${themeClasses}`}>
      {/* ===== LEFT SIDEBAR ===== */}
      <aside className="flex h-full">
        {/* Icon Bar */}
        <div className={`w-12 border-r flex flex-col items-center py-2 gap-1 ${sidebarClasses}`}>
          {/* Logo */}
          <div className="w-10 h-10 flex items-center justify-center mb-2">
            <span className="text-2xl" title="AI Digital Friend Zone">🚀</span>
          </div>
          
          <div className={`w-8 h-px ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'} my-1`} />
          
          {/* Left Tab Icons */}
          {leftSidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (leftTab === item.id && leftSidebarOpen) {
                  setLeftSidebarOpen(false);
                } else {
                  setLeftTab(item.id);
                  setLeftSidebarOpen(true);
                }
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all relative group
                ${leftTab === item.id && leftSidebarOpen
                  ? iconBarBtnActive 
                  : iconBarBtnInactive
                }`}
              title={item.tooltip}
            >
              <span className="text-lg">{item.icon}</span>
              {leftTab === item.id && leftSidebarOpen && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-indigo-500 rounded-r" />
              )}
              {/* Tooltip */}
              <div className={`absolute left-full ml-2 px-2 py-1 ${tooltipClasses} text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity shadow-lg`}>
                {item.tooltip}
              </div>
            </button>
          ))}
          
          <div className="flex-1" />
          
          {/* View Mode Icons */}
          <div className={`w-8 h-px ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-300'} my-1`} />
          
          <button
            onClick={() => setViewMode('code')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all group relative
              ${viewMode === 'code' ? iconBarBtnActive : iconBarBtnInactive}`}
            title="Code Only"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <div className={`absolute left-full ml-2 px-2 py-1 ${tooltipClasses} text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg`}>
              Code Only
            </div>
          </button>
          
          <button
            onClick={() => setViewMode('split')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all group relative
              ${viewMode === 'split' ? iconBarBtnActive : iconBarBtnInactive}`}
            title="Split View (Code + Preview)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            <div className={`absolute left-full ml-2 px-2 py-1 ${tooltipClasses} text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg`}>
              Split View
            </div>
          </button>
          
          <button
            onClick={() => setViewMode('preview')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all group relative
              ${viewMode === 'preview' ? iconBarBtnActive : iconBarBtnInactive}`}
            title="Preview Only"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <div className={`absolute left-full ml-2 px-2 py-1 ${tooltipClasses} text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg`}>
              Preview Only
            </div>
          </button>
        </div>
        
        {/* Left Panel Content */}
        {leftSidebarOpen && (
          <div className={`w-64 border-r flex flex-col ${panelClasses}`}>
            {/* Panel Header */}
            <div className={`h-10 flex items-center justify-between px-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'} uppercase tracking-wider`}>
                {leftSidebarItems.find(i => i.id === leftTab)?.label}
              </span>
              <button
                onClick={() => setLeftSidebarOpen(false)}
                className={`p-1 ${theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'} rounded transition-colors`}
                title="Close Panel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {leftTab === 'files' && <FileExplorer files={files} onFileSelect={handleFileSelect} />}
              {leftTab === 'templates' && <TemplateGallery />}
              {leftTab === 'extensions' && <ExtensionsPanel />}
              {leftTab === 'history' && <HistoryPanel />}
              {leftTab === 'search' && (
                <div className="p-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search files..."
                      className={`w-full px-3 py-2 pl-9 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'}`}
                    />
                    <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'} mt-4 text-center`}>Type to search across all files</p>
                </div>
              )}
            </div>
            
            {/* Project Info */}
            {currentProject && (
              <div className={`p-3 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className={`flex items-center gap-2 text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  <span>📁</span>
                  <span className="truncate">{currentProject.name}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Clean Header */}
        <header className={`h-10 border-b flex items-center justify-center px-4 ${headerClasses}`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>🚀 AI Digital Friend Zone</span>
            {currentProject && (
              <>
                <span className={theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}>—</span>
                <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{currentProject.name}</span>
              </>
            )}
          </div>
        </header>

        {/* Editor + Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Code Editor */}
          {(viewMode === 'code' || viewMode === 'split') && (
            <div className={viewMode === 'split' ? 'w-1/2' : 'w-full'}>
              <CodeEditor />
            </div>
          )}
          
          {/* Inline Preview for Split/Preview modes */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div className={`${viewMode === 'split' ? 'w-1/2 border-l' : 'w-full'} ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <LivePreview />
            </div>
          )}
        </div>

        {/* Status Bar */}
        <footer className={`h-6 border-t flex items-center justify-between px-4 text-xs ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              Ready
            </span>
            {currentProject && <span>{currentProject.template}</span>}
          </div>
          <div className="flex items-center gap-4">
            <span>TypeScript</span>
            <span>UTF-8</span>
            <span>Spaces: 2</span>
          </div>
        </footer>
      </main>

      {/* ===== RIGHT SIDEBAR ===== */}
      <aside className="flex h-full flex-row-reverse">
        {/* Icon Bar */}
        <div className={`w-12 border-l flex flex-col items-center py-2 gap-1 ${sidebarClasses}`}>
          {/* Right Tab Icons */}
          {rightSidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (rightTab === item.id && rightSidebarOpen) {
                  setRightSidebarOpen(false);
                } else {
                  setRightTab(item.id);
                  setRightSidebarOpen(true);
                }
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all relative group
                ${rightTab === item.id && rightSidebarOpen
                  ? theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-gray-300 text-gray-900'
                  : theme === 'dark' ? 'text-slate-500 hover:text-white hover:bg-slate-800/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-300/50'
                }`}
              title={item.tooltip}
            >
              <span className="text-lg">{item.icon}</span>
              {rightTab === item.id && rightSidebarOpen && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-indigo-500 rounded-l" />
              )}
              {/* Tooltip */}
              <div className={`absolute right-full mr-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity shadow-lg ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-800 text-white'}`}>
                {item.tooltip}
              </div>
            </button>
          ))}
          
          <div className={`w-8 h-px ${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-300'} my-2`} />
          
          {/* Media buttons - Camera, Screenshot, Voice */}
          <button
            onClick={handleCameraToggle}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all group relative ${
              cameraActive 
                ? 'bg-red-500 text-white' 
                : theme === 'dark' ? 'text-slate-500 hover:text-white hover:bg-slate-800/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-300/50'
            }`}
            title={cameraActive ? "Stop Camera" : "Start Camera"}
          >
            <span className="text-lg">{cameraActive ? '🔴' : '📷'}</span>
            <div className={`absolute right-full mr-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-800 text-white'}`}>
              {cameraActive ? 'Stop Camera' : 'Start Camera'}
            </div>
          </button>
          <button
            onClick={handleScreenshot}
            disabled={isCapturing}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all group relative ${
              isCapturing 
                ? 'bg-blue-500 text-white animate-pulse' 
                : theme === 'dark' ? 'text-slate-500 hover:text-white hover:bg-slate-800/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-300/50'
            }`}
            title="Screenshot"
          >
            <span className="text-lg">{isCapturing ? '⏳' : '🖥️'}</span>
            <div className={`absolute right-full mr-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-800 text-white'}`}>
              {isCapturing ? 'Capturing...' : 'Take Screenshot'}
            </div>
          </button>
          <button
            onClick={handleVoiceToggle}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all group relative ${
              voiceEnabled 
                ? theme === 'dark' ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'
                : theme === 'dark' ? 'text-slate-500 hover:text-white hover:bg-slate-800/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-300/50'
            }`}
            title={voiceEnabled ? "Voice On - Click to Turn Off" : "Voice Off - Click to Turn On"}
          >
            <span className="text-lg">{voiceEnabled ? '🔊' : '🔇'}</span>
            <div className={`absolute right-full mr-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-800 text-white'}`}>
              {voiceEnabled ? 'Voice ON - Click to mute' : 'Voice OFF - Click to enable'}
            </div>
          </button>
          
          <div className="flex-1" />
          
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all group relative ${theme === 'dark' ? 'text-slate-500 hover:text-white hover:bg-slate-800/50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-300/50'}`}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            <span className="text-lg">{theme === 'dark' ? '🌙' : '☀️'}</span>
            <div className={`absolute right-full mr-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-800 text-white'}`}>
              {theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </div>
          </button>
        </div>
        
        {/* Right Panel Content */}
        {rightSidebarOpen && (
          <div className={`w-96 border-l flex flex-col ${panelClasses}`}>
            {/* Panel Header */}
            <div className={`h-10 flex items-center justify-between px-4 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'} uppercase tracking-wider`}>
                {rightSidebarItems.find(i => i.id === rightTab)?.label}
              </span>
              <button
                onClick={() => setRightSidebarOpen(false)}
                className={`p-1 ${theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'} rounded transition-colors`}
                title="Close Panel"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Panel Content */}
            <div className="flex-1 overflow-hidden">
              {rightTab === 'ai' && <AgenticAIChat voiceEnabled={voiceEnabled} />}
              {rightTab === 'deploy' && <DeployPanel />}
              {rightTab === 'settings' && <SettingsPanel theme={theme} setTheme={setTheme} />}
            </div>
          </div>
        )}
      </aside>
      
      {/* Hidden elements for camera capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Camera Preview Modal */}
      {cameraActive && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`${theme === 'dark' ? 'bg-slate-800' : 'bg-white'} rounded-xl p-4 max-w-2xl w-full mx-4 shadow-2xl`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>📷 Camera Preview</h3>
              <button
                onClick={handleCameraToggle}
                className="p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={capturePhoto}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <span>📸</span> Capture Photo
              </button>
              <button
                onClick={handleCameraToggle}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <span>⏹️</span> Stop Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
