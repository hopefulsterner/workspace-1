import React, { useState } from 'react';
import { useStore } from '../store/useStore';

type DeviceView = 'desktop' | 'tablet' | 'mobile';

export const LivePreview: React.FC = () => {
  const { openFiles, activeFileId, theme } = useStore();
  const [deviceView, setDeviceView] = useState<DeviceView>('desktop');

  const activeFile = openFiles.find(f => f.id === activeFileId);

  // Generate preview HTML from current files
  const generatePreviewContent = () => {
    // Find HTML file
    const htmlFile = openFiles.find(f => f.name.endsWith('.html'));
    
    if (htmlFile) {
      // Simple HTML preview
      return htmlFile.content;
    }

    // Default preview for non-HTML files
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              background: linear-gradient(135deg, #1e1b4b, #312e81);
              min-height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            h1 {
              font-size: 2rem;
              margin-bottom: 1rem;
            }
            p {
              color: #a5b4fc;
              margin-bottom: 2rem;
            }
            .status {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              background: rgba(99, 102, 241, 0.2);
              padding: 0.5rem 1rem;
              border-radius: 9999px;
              font-size: 0.875rem;
            }
            .dot {
              width: 8px;
              height: 8px;
              background: #4ade80;
              border-radius: 50%;
              animation: pulse 2s infinite;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🚀 Live Preview</h1>
            <p>Your app will appear here when you run it</p>
            <div class="status">
              <div class="dot"></div>
              Ready to preview
            </div>
          </div>
        </body>
      </html>
    `;
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Preview Header */}
      <div className={`flex items-center justify-between px-4 py-2 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'} border-b`}>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1 ${theme === 'dark' ? 'bg-slate-900' : 'bg-white border border-gray-200'} rounded-lg`}>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>localhost:3000</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'} transition-colors`}
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            className={`p-1.5 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'} transition-colors`}
            title="Open in New Tab"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setDeviceView('desktop')}
              className={`p-1.5 rounded transition-colors ${deviceView === 'desktop' 
                ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-700')
                : (theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700')
              }`}
              title="Desktop View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setDeviceView('tablet')}
              className={`p-1.5 rounded transition-colors ${deviceView === 'tablet' 
                ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-700')
                : (theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700')
              }`}
              title="Tablet/iPad View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setDeviceView('mobile')}
              className={`p-1.5 rounded transition-colors ${deviceView === 'mobile' 
                ? (theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-gray-200 text-gray-700')
                : (theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700')
              }`}
              title="Mobile View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className={`flex-1 flex items-center justify-center overflow-auto ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'}`}>
        <div 
          className={`bg-white h-full transition-all duration-300 ${
            deviceView === 'desktop' 
              ? 'w-full' 
              : deviceView === 'tablet'
                ? 'w-[768px] max-w-full shadow-2xl rounded-lg border border-gray-300'
                : 'w-[375px] max-w-full shadow-2xl rounded-lg border border-gray-300'
          }`}
          style={deviceView !== 'desktop' ? { maxHeight: 'calc(100% - 32px)', margin: '16px 0' } : {}}
        >
          <iframe
            srcDoc={generatePreviewContent()}
            className="w-full h-full border-0"
            title="Live Preview"
            sandbox="allow-scripts allow-modals"
          />
        </div>
      </div>
    </div>
  );
};
