
import React from 'react';
import { AppConfig } from '../types';
import { Icons } from '../constants';

interface SidebarProps {
  apps: AppConfig[];
  currentAppId: string | null;
  onSelectApp: (id: string) => void;
  onNewApp: () => void;
  onDeleteApp: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  apps, 
  currentAppId, 
  onSelectApp, 
  onNewApp,
  onDeleteApp,
  isOpen,
  onToggle
}) => {
  return (
    <div className={`bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-screen flex flex-col shrink-0 transition-all duration-300 ${isOpen ? 'w-72' : 'w-16'}`}>
      <div className={`p-4 border-b border-slate-100 dark:border-slate-700 flex items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
        {isOpen ? (
          <h1 className="text-xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            Architect
          </h1>
        ) : (
          <span className="text-2xl">⚡</span>
        )}
        <button onClick={onToggle} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400">
          <Icons.PanelLeft />
        </button>
      </div>
      
      <div className="p-4">
        <button 
          onClick={onNewApp}
          className={`w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-all shadow-sm active:scale-95 ${!isOpen ? 'px-0 h-10 w-10 mx-auto' : 'px-4'}`}
          title="Create New App"
        >
          <Icons.Plus />
          {isOpen && "Create New App"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {isOpen && (
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-3 py-2 uppercase tracking-wider">
            Workspace Apps
          </div>
        )}
        {apps.length === 0 && isOpen && (
          <div className="p-4 text-center text-sm text-slate-400 dark:text-slate-500 italic">
            No apps yet
          </div>
        )}
        {apps.map((app) => (
          <div 
            key={app.id}
            className={`group relative flex items-center gap-3 rounded-lg cursor-pointer transition-colors ${
              currentAppId === app.id 
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-100 dark:border-indigo-800' 
                : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400'
            } ${isOpen ? 'px-3 py-3' : 'p-3 justify-center'}`}
            onClick={() => onSelectApp(app.id)}
            title={!isOpen ? app.name : ""}
          >
            <span className="text-xl shrink-0">{app.icon}</span>
            {isOpen && (
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm">{app.name}</div>
                <div className="truncate text-[10px] opacity-70 uppercase tracking-tighter">
                  {app.model.split('-').slice(2, 4).join(' ')}
                </div>
              </div>
            )}
            {isOpen && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteApp(app.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-all text-slate-400"
              >
                <Icons.Trash />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-slate-700">
        <div className={`flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 ${!isOpen && 'justify-center'}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            JD
          </div>
          {isOpen && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">Dev User</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">Pro Plan</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
