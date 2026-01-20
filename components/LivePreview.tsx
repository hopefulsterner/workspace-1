import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { webContainerService } from '../services/webcontainer';

type DeviceView = 'desktop' | 'tablet' | 'mobile';

export const LivePreview: React.FC = () => {
  const { files, theme } = useStore();
  const [deviceView, setDeviceView] = useState<DeviceView>('desktop');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBuildTime, setLastBuildTime] = useState<number>(0);
  const [webContainerUrl, setWebContainerUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for WebContainer server-ready events
  useEffect(() => {
    if (webContainerService.getInstance()) {
      webContainerService.onServerReady((port, url) => {
        console.log('[Preview] Server ready at:', url);
        setWebContainerUrl(url);
      });
    }
  }, []);

  // Get device dimensions
  const getDeviceStyle = () => {
    switch (deviceView) {
      case 'mobile':
        return { width: '375px', height: '100%' };
      case 'tablet':
        return { width: '768px', height: '100%' };
      default:
        return { width: '100%', height: '100%' };
    }
  };

  // Find all project files recursively
  const getAllFiles = useCallback((nodes: typeof files): { path: string; content: string; type: string }[] => {
    const result: { path: string; content: string; type: string }[] = [];
    
    const traverse = (items: typeof files) => {
      for (const item of items) {
        if (item.type === 'file' && item.content) {
          result.push({
            path: item.path,
            content: item.content,
            type: item.name.split('.').pop() || 'txt',
          });
        }
        if (item.children) {
          traverse(item.children);
        }
      }
    };
    
    traverse(nodes);
    return result;
  }, []);

  // Generate preview HTML from project files
  const generatePreviewHTML = useCallback(() => {
    const projectFiles = getAllFiles(files);
    
    if (projectFiles.length === 0) {
      return getDefaultPreview();
    }

    // Find key files
    const htmlFile = projectFiles.find(f => f.path.endsWith('index.html') || f.path.endsWith('.html'));
    const cssFiles = projectFiles.filter(f => f.type === 'css');
    const jsFiles = projectFiles.filter(f => f.type === 'js');
    const tsxFiles = projectFiles.filter(f => f.type === 'tsx' || f.type === 'jsx');

    // If we have an HTML file, use it as base
    if (htmlFile) {
      let html = htmlFile.content;
      
      // Inject CSS
      const cssContent = cssFiles.map(f => f.content).join('\n');
      if (cssContent) {
        html = html.replace('</head>', `<style>${cssContent}</style></head>`);
      }
      
      // Inject JS
      const jsContent = jsFiles.map(f => f.content).join('\n');
      if (jsContent) {
        html = html.replace('</body>', `<script>${jsContent}</script></body>`);
      }
      
      return html;
    }

    // If we have React/TSX files, build a React preview
    if (tsxFiles.length > 0) {
      return buildReactPreview(projectFiles);
    }

    // If we only have CSS/JS, show a basic preview
    if (cssFiles.length > 0 || jsFiles.length > 0) {
      return buildBasicPreview(cssFiles, jsFiles);
    }

    return getDefaultPreview();
  }, [files, getAllFiles]);

  // Build React preview
  const buildReactPreview = (projectFiles: { path: string; content: string; type: string }[]) => {
    // Find App component
    const appFile = projectFiles.find(f => 
      f.path.includes('App.tsx') || 
      f.path.includes('App.jsx') ||
      f.path.includes('app.tsx')
    );
    
    // Find all component files
    const componentFiles = projectFiles.filter(f => 
      (f.type === 'tsx' || f.type === 'jsx') && 
      !f.path.includes('main.') &&
      !f.path.includes('index.')
    );

    // Find CSS files
    const cssFiles = projectFiles.filter(f => f.type === 'css');
    const cssContent = cssFiles.map(f => f.content).join('\n');

    // Simple React component renderer
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script crossorigin src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script crossorigin src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    ${cssContent}
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    const { useState, useEffect, useRef, useCallback, useMemo } = React;
    
    // Component definitions
    ${componentFiles.map(f => {
      // Extract component code (remove imports/exports for browser)
      let code = f.content
        .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?/g, '')
        .replace(/export\s+default\s+/g, '')
        .replace(/export\s+/g, '');
      return `// ${f.path}\n${code}`;
    }).join('\n\n')}
    
    // Main App
    ${appFile ? appFile.content
        .replace(/import\s+.*?from\s+['"][^'"]+['"]\s*;?/g, '')
        .replace(/export\s+default\s+/g, '')
        .replace(/export\s+/g, '')
      : `
      function App() {
        return (
          <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center text-white">
            <div className="text-center p-8">
              <h1 className="text-4xl font-bold mb-4">🚀 Your App</h1>
              <p className="text-slate-300">Components are loading...</p>
            </div>
          </div>
        );
      }
    `}
    
    // Render
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<App />);
  </script>
</body>
</html>`;
  };

  // Build basic HTML/CSS/JS preview
  const buildBasicPreview = (
    cssFiles: { path: string; content: string }[],
    jsFiles: { path: string; content: string }[]
  ) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script crossorigin src="https://cdn.tailwindcss.com"></script>
  <style>
    ${cssFiles.map(f => f.content).join('\n')}
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    ${jsFiles.map(f => f.content).join('\n')}
  </script>
</body>
</html>`;
  };

  // Default preview when no files
  const getDefaultPreview = () => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script crossorigin src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-slate-900 to-indigo-900 min-h-screen flex items-center justify-center">
  <div class="text-center text-white p-8">
    <div class="text-6xl mb-6">🚀</div>
    <h1 class="text-3xl font-bold mb-4">Live Preview</h1>
    <p class="text-slate-300 mb-6">Your app will appear here when you create files</p>
    <div class="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm">
      <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
      Ready
    </div>
  </div>
</body>
</html>`;
  };

  // Update preview when files change
  useEffect(() => {
    const updatePreview = () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // If WebContainer has a server running, use that URL
        if (webContainerUrl) {
          if (iframeRef.current) {
            iframeRef.current.src = webContainerUrl;
            setLastBuildTime(Date.now());
          }
        } else {
          // Otherwise generate preview HTML from files
          const html = generatePreviewHTML();
          
          if (iframeRef.current) {
            const iframe = iframeRef.current;
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            
            if (doc) {
              doc.open();
              doc.write(html);
              doc.close();
              setLastBuildTime(Date.now());
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Preview error');
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce updates
    const timeout = setTimeout(updatePreview, 300);
    return () => clearTimeout(timeout);
  }, [files, generatePreviewHTML, webContainerUrl]);

  // Manual refresh
  const handleRefresh = () => {
    setIsLoading(true);
    
    // If WebContainer has a server running, use that
    if (webContainerUrl) {
      if (iframeRef.current) {
        iframeRef.current.src = webContainerUrl;
        setLastBuildTime(Date.now());
      }
    } else {
      const html = generatePreviewHTML();
      
      if (iframeRef.current) {
        const iframe = iframeRef.current;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setLastBuildTime(Date.now());
        }
      }
    }
    
    setTimeout(() => setIsLoading(false), 500);
  };

  // Open in new tab
  const handleOpenNewTab = () => {
    const html = generatePreviewHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const deviceStyle = getDeviceStyle();

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Preview Header */}
      <div className={`flex items-center justify-between px-4 py-2 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'} border-b`}>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white border border-gray-200'} rounded-lg`}>
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500' : webContainerUrl ? 'bg-green-500' : 'bg-blue-500'} animate-pulse`} />
            <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
              {isLoading ? 'Building...' : webContainerUrl ? 'Server Running' : 'localhost:3000'}
            </span>
          </div>
          {lastBuildTime > 0 && (
            <span className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-gray-400'}`}>
              Last build: {new Date(lastBuildTime).toLocaleTimeString()}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'} transition-colors disabled:opacity-50`}
            title="Refresh Preview"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          
          <button
            onClick={handleOpenNewTab}
            className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'} transition-colors`}
            title="Open in New Tab"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          
          {/* Device toggles */}
          <div className="flex items-center gap-1 ml-2 border-l border-slate-600 pl-2">
            {(['desktop', 'tablet', 'mobile'] as DeviceView[]).map((device) => (
              <button
                key={device}
                onClick={() => setDeviceView(device)}
                className={`p-1.5 rounded transition-colors ${
                  deviceView === device
                    ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-700')
                    : (theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500')
                }`}
                title={`${device.charAt(0).toUpperCase() + device.slice(1)} View`}
              >
                {device === 'desktop' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                {device === 'tablet' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
                {device === 'mobile' && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className={`flex-1 flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-slate-950' : 'bg-gray-100'}`}>
        {error ? (
          <div className="text-red-500 text-center p-4">
            <div className="text-4xl mb-2">⚠️</div>
            <p>{error}</p>
          </div>
        ) : (
          <div 
            className={`bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ${
              deviceView !== 'desktop' ? 'border-8 border-slate-800 rounded-3xl' : ''
            }`}
            style={deviceStyle}
          >
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              title="Live Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePreview;
