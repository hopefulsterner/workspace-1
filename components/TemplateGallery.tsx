import React from 'react';
import { TEMPLATES } from '../data/templates';
import { useStore } from '../store/useStore';
import { FileNode, ProjectTemplate } from '../types';

export const TemplateGallery: React.FC = () => {
  const { createProject, setSidebarTab, theme } = useStore();

  const handleSelectTemplate = (template: ProjectTemplate) => {
    // Convert template files to FileNode structure
    const files: FileNode[] = [];
    
    Object.entries(template.files).forEach(([path, content]) => {
      if (path === 'package.json' && content === '') {
        // Generate package.json
        content = JSON.stringify({
          name: template.id,
          version: '1.0.0',
          private: true,
          scripts: template.scripts || {},
          dependencies: template.dependencies || {},
          devDependencies: template.devDependencies || {},
        }, null, 2);
      }

      const parts = path.split('/');
      const fileName = parts.pop()!;
      
      // Create file node
      const fileNode: FileNode = {
        id: crypto.randomUUID(),
        name: fileName,
        type: 'file',
        path: path,
        content: content,
        language: getLanguageFromFilename(fileName),
      };

      // If nested, create folder structure
      if (parts.length > 0) {
        let currentPath = '';
        parts.forEach((folderName) => {
          currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
          
          // Check if folder exists
          if (!files.find(f => f.path === currentPath)) {
            files.push({
              id: crypto.randomUUID(),
              name: folderName,
              type: 'folder',
              path: currentPath,
              children: [],
            });
          }
        });
      }
      
      files.push(fileNode);
    });

    // Organize into tree structure
    const rootFiles: FileNode[] = [];
    const folderMap = new Map<string, FileNode>();

    // First pass: identify all folders
    files.filter(f => f.type === 'folder').forEach(folder => {
      folderMap.set(folder.path, { ...folder, children: [] });
    });

    // Second pass: organize files into folders
    files.filter(f => f.type === 'file').forEach(file => {
      const parentPath = file.path.split('/').slice(0, -1).join('/');
      
      if (parentPath && folderMap.has(parentPath)) {
        folderMap.get(parentPath)!.children!.push(file);
      } else {
        rootFiles.push(file);
      }
    });

    // Third pass: organize folders into parent folders or root
    folderMap.forEach((folder, path) => {
      const parentPath = path.split('/').slice(0, -1).join('/');
      
      if (parentPath && folderMap.has(parentPath)) {
        folderMap.get(parentPath)!.children!.push(folder);
      } else {
        rootFiles.push(folder);
      }
    });

    createProject(template.name, template.id, rootFiles);
    setSidebarTab('files');
  };

  const categories = [
    { id: 'frontend', name: 'Frontend', icon: '🎨' },
    { id: 'backend', name: 'Backend', icon: '⚙️' },
    { id: 'fullstack', name: 'Full Stack', icon: '🚀' },
    { id: 'static', name: 'Static', icon: '🌐' },
    { id: 'api', name: 'API', icon: '🔌' },
  ];

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-6">
        <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-2`}>Start a New Project</h2>
        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>Choose a template to get started quickly</p>
      </div>

      {categories.map((category) => {
        const categoryTemplates = TEMPLATES.filter(t => t.category === category.id);
        if (categoryTemplates.length === 0) return null;

        return (
          <div key={category.id} className="mb-6">
            <h3 className={`text-xs font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'} uppercase tracking-wider mb-3 flex items-center gap-2`}>
              <span>{category.icon}</span>
              {category.name}
            </h3>
            <div className="grid gap-3">
              {categoryTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`flex items-start gap-3 p-4 ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'} border hover:border-indigo-500 rounded-xl transition-all text-left group`}
                >
                  <span className="text-2xl">{template.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} group-hover:text-indigo-500 transition-colors`}>
                      {template.name}
                    </h4>
                    <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} mt-0.5`}>{template.description}</p>
                  </div>
                  <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'} group-hover:text-indigo-500 transition-colors mt-1`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Custom Project */}
      <div className={`mt-8 p-4 border-2 border-dashed ${theme === 'dark' ? 'border-slate-700' : 'border-gray-300'} rounded-xl text-center`}>
        <div className="text-3xl mb-2">✨</div>
        <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} mb-1`}>Start from Scratch</h4>
        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'} mb-3`}>Create an empty project or describe what you want to build</p>
        <button
          onClick={() => {
            createProject('My Project', 'custom', []);
            setSidebarTab('files');
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Create Empty Project
        </button>
      </div>
    </div>
  );
};

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    vue: 'vue',
  };
  return langMap[ext || ''] || 'plaintext';
}
