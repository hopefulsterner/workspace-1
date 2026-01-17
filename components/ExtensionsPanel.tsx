import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { extensionManager, initializeExtensions } from '../services/extensions';

export const ExtensionsPanel: React.FC = () => {
  const { extensions, toggleExtension, resetExtensions, syncExtensions, theme } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('installed');

  useEffect(() => {
    // Sync extensions on mount to add any new ones
    if (extensions.length < 20) {
      resetExtensions();
    } else {
      syncExtensions();
    }
    initializeExtensions();
  }, []);

  // Filter extensions based on search
  const filteredExtensions = extensions.filter(ext =>
    ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ext.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate installed and not installed
  const installedExtensions = filteredExtensions.filter(ext => ext.enabled === true);
  const availableExtensions = filteredExtensions.filter(ext => ext.enabled !== true);

  const handleInstall = (extId: string) => {
    toggleExtension(extId);
    extensionManager.enable(extId);
  };

  const handleUninstall = (extId: string) => {
    toggleExtension(extId);
    extensionManager.disable(extId);
  };

  const displayedExtensions = activeTab === 'installed' ? installedExtensions : availableExtensions;

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🧩</span>
          <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Extensions</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
          {installedExtensions.length} active
        </span>
      </div>

      {/* Search */}
      <div className={`p-3 border-b ${theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'}`}>
        <div className="relative">
          <input
            type="text"
            placeholder="Search extensions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'}`}
          />
          <svg className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
        <button
          onClick={() => setActiveTab('installed')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'installed' 
              ? 'text-indigo-500 border-b-2 border-indigo-500' 
              : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Installed ({installedExtensions.length})
        </button>
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'available' 
              ? 'text-indigo-500 border-b-2 border-indigo-500' 
              : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Available ({availableExtensions.length})
        </button>
      </div>

      {/* Extension List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {displayedExtensions.length > 0 ? (
          displayedExtensions.map(ext => (
            <div
              key={ext.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${theme === 'dark' ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-50 hover:bg-gray-100'}`}
            >
              {/* Icon */}
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'}`}>
                {ext.icon || '🧩'}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-medium truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {ext.name}
                </h4>
                <p className={`text-xs truncate ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
                  {ext.description}
                </p>
                <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
                  v{ext.version}
                </span>
              </div>
              
              {/* Install/Uninstall Button */}
              {activeTab === 'installed' ? (
                <button
                  onClick={() => handleUninstall(ext.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    theme === 'dark' 
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  Uninstall
                </button>
              ) : (
                <button
                  onClick={() => handleInstall(ext.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    theme === 'dark' 
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                      : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                  }`}
                >
                  Install
                </button>
              )}
            </div>
          ))
        ) : (
          <div className={`text-center py-8 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            <div className="text-4xl mb-3">
              {activeTab === 'installed' ? '📭' : '✨'}
            </div>
            <p className="text-sm">
              {activeTab === 'installed' 
                ? 'No extensions installed' 
                : 'All extensions are installed!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
