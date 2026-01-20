import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '../store/useStore';
import { ChatMessage } from '../types';
import { voiceInput, voiceOutput, speechSupport } from '../services/speech';
import { aiAgentService, FileOperation } from '../services/aiAgent';
import { socketService } from '../services/socket';

interface AgenticAIChatProps {
  voiceEnabled?: boolean;
  onFileOperation?: (operation: FileOperation) => void;
  onTerminalCommand?: (command: string) => void;
}

export const AgenticAIChat: React.FC<AgenticAIChatProps> = ({ 
  voiceEnabled: externalVoiceEnabled = false,
  onFileOperation,
  onTerminalCommand,
}) => {
  const { 
    chatHistory, 
    addMessage, 
    clearChat, 
    aiConfig,
    isAiLoading,
    setAiLoading,
    openFiles,
    activeFileId,
    theme,
    createFile,
    createFolder,
    files,
    openFile,
    currentProject,
    createProject,
    setCurrentProject,
  } = useStore();
  
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [createdFiles, setCreatedFiles] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeFile = openFiles.find(f => f.id === activeFileId);
  
  // Theme classes
  const bgClass = theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50';
  const borderClass = theme === 'dark' ? 'border-slate-700' : 'border-gray-200';
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const mutedTextClass = theme === 'dark' ? 'text-slate-400' : 'text-gray-500';
  const inputBgClass = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300';

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, streamingContent]);

  // Connect to socket on mount
  useEffect(() => {
    const connect = async () => {
      setConnectionStatus('connecting');
      try {
        await socketService.connect();
        setConnectionStatus('connected');
      } catch (err) {
        console.error('Socket connection failed:', err);
        setConnectionStatus('disconnected');
      }
    };
    
    connect();
    
    return () => {
      // Don't disconnect on unmount, keep connection alive
    };
  }, []);

  // Handle file operation from AI
  const handleFileOperation = useCallback((operation: FileOperation) => {
    console.log('[AI] File operation:', operation);
    
    if (onFileOperation) {
      onFileOperation(operation);
    } else {
      // Default handler - create/edit files in store
      if (operation.type === 'create' || operation.type === 'edit') {
        const pathParts = operation.path.split('/');
        const fileName = pathParts.pop() || operation.path;
        const parentPath = pathParts.length > 0 ? pathParts.join('/') : '';
        
        // Create parent folders if they don't exist
        if (parentPath) {
          const folderParts = parentPath.split('/');
          let currentPath = '';
          for (const folder of folderParts) {
            const folderPath = currentPath ? `${currentPath}/${folder}` : folder;
            // Check if folder exists in files
            const folderExists = files.some(f => f.path === folderPath && f.type === 'folder');
            if (!folderExists) {
              createFolder(currentPath, folder);
            }
            currentPath = folderPath;
          }
        }
        
        // Determine language from extension
        const ext = fileName.split('.').pop() || '';
        const languageMap: Record<string, string> = {
          'ts': 'typescript',
          'tsx': 'typescript',
          'js': 'javascript',
          'jsx': 'javascript',
          'py': 'python',
          'html': 'html',
          'css': 'css',
          'json': 'json',
          'md': 'markdown',
          'yml': 'yaml',
          'yaml': 'yaml',
          'sh': 'bash',
          'env': 'plaintext',
        };
        const language = languageMap[ext] || 'plaintext';
        
        // Create the file
        createFile(parentPath, fileName, operation.content);
        
        // Track created files for display
        setCreatedFiles(prev => [...prev, operation.path]);
        
        // Auto-open the file in editor
        const fileId = crypto.randomUUID();
        openFile({
          id: fileId,
          name: fileName,
          path: operation.path,
          content: operation.content || '',
          language,
          isDirty: false,
        });
        
        console.log(`[AI] Created/Updated file: ${operation.path}`);
      } else if (operation.type === 'delete') {
        // Handle delete operation - for now just log
        console.log(`[AI] Delete requested for: ${operation.path}`);
      }
    }
  }, [onFileOperation, createFile, createFolder, openFile, files]);

  // Handle terminal command from AI
  const handleTerminalCommand = useCallback((command: string) => {
    console.log('[AI] Terminal command:', command);
    if (onTerminalCommand) {
      onTerminalCommand(command);
    }
  }, [onTerminalCommand]);

  // Voice input handler
  const handleVoiceInput = async () => {
    if (!speechSupport.recognition) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    if (isListening) {
      voiceInput.stop();
      setIsListening(false);
      return;
    }

    setIsListening(true);
    voiceInput.start({
      onResult: (result) => {
        setInput(prev => result.isFinal ? result.transcript : prev);
      },
      onError: (error) => {
        console.error('Voice input error:', error);
        setIsListening(false);
      },
      onEnd: () => {
        setIsListening(false);
      },
    }, { continuous: true, interimResults: true });
  };

  // Speak response
  const handleSpeak = (text: string) => {
    if (!externalVoiceEnabled || !speechSupport.synthesis) return;
    
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`[^`]+`/g, '')
      .slice(0, 500);
    
    voiceOutput.speak(cleanText, {
      rate: 1,
      pitch: 1,
      onEnd: () => {},
      onError: () => {},
    });
  };

  // Send message with streaming
  const handleSend = async () => {
    if (!input.trim() || isAiLoading || isStreaming) return;

    // Build attachments
    const attachments: ChatMessage['attachments'] = [];
    
    if (activeFile) {
      attachments.push({
        type: 'code',
        name: activeFile.name,
        content: activeFile.content,
      });
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    addMessage(userMessage);
    setInput('');
    setAiLoading(true);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      // Prepare message with context
      let fullMessage = input;
      if (activeFile) {
        fullMessage += `\n\n[Current file: ${activeFile.name}]\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\``;
      }
      
      // Add context about existing files with their content
      if (files.length > 0) {
        const projectContext = files.map(f => {
          if (f.type === 'file' && f.content) {
            // Include file content for context (truncate if too long)
            const truncatedContent = f.content.length > 2000 
              ? f.content.substring(0, 2000) + '\n... (truncated)'
              : f.content;
            return `[File: ${f.path}]\n\`\`\`\n${truncatedContent}\n\`\`\``;
          }
          return f.type === 'folder' ? `[Folder: ${f.path}]` : `[File: ${f.path}]`;
        }).join('\n\n');
        fullMessage += `\n\n--- EXISTING PROJECT FILES ---\n${projectContext}\n--- END PROJECT FILES ---`;
      }

      // Build messages for AI
      const messagesForAI = [
        ...chatHistory.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: fullMessage },
      ];

      // Try streaming via WebSocket first
      if (socketService.isConnected()) {
        await new Promise<void>((resolve, reject) => {
          let fullResponse = '';
          
          // Helper to clean response for display (remove file operation tags)
          const cleanForDisplay = (text: string): string => {
            return text
              .replace(/<file_create\s+path="[^"]*">[\s\S]*?<\/file_create>/g, '\n📄 Creating file...\n')
              .replace(/<file_edit\s+path="[^"]*">[\s\S]*?<\/file_edit>/g, '\n📝 Editing file...\n')
              .replace(/<file_delete\s+path="[^"]*"\s*\/>/g, '\n🗑️ Deleting file...\n')
              .replace(/<terminal_run>[\s\S]*?<\/terminal_run>/g, '\n💻 Running command...\n')
              // Also clean incomplete tags during streaming
              .replace(/<file_create\s+path="[^"]*">[\s\S]*$/g, '\n📄 Creating file...')
              .replace(/<file_edit\s+path="[^"]*">[\s\S]*$/g, '\n📝 Editing file...')
              .replace(/<terminal_run>[\s\S]*$/g, '\n💻 Running command...')
              .trim();
          };
          
          aiAgentService.streamChat(
            messagesForAI,
            {
              onToken: (token) => {
                fullResponse += token;
                // Show cleaned content during streaming
                setStreamingContent(cleanForDisplay(fullResponse));
              },
              onComplete: (response) => {
                setStreamingContent('');
                setIsStreaming(false);
                
                const assistantMessage: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: response,
                  timestamp: Date.now(),
                };
                addMessage(assistantMessage);
                
                if (externalVoiceEnabled && speechSupport.synthesis) {
                  handleSpeak(response);
                }
                
                resolve();
              },
              onError: (error) => {
                reject(error);
              },
              onFileOperation: handleFileOperation,
              onTerminalCommand: handleTerminalCommand,
            },
            'openai',
            'gpt-4o-mini'
          );
        });
      } else {
        // Fallback to REST API
        const result = await aiAgentService.sendMessage(messagesForAI, 'openai', 'gpt-4o-mini');
        
        // Execute file operations
        result.operations.forEach(handleFileOperation);
        result.commands.forEach(handleTerminalCommand);
        
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.response,
          timestamp: Date.now(),
        };
        addMessage(assistantMessage);
        
        if (externalVoiceEnabled && speechSupport.synthesis) {
          handleSpeak(result.response);
        }
      }
      
      // Save project to history if files were created
      if (createdFiles.length > 0) {
        saveProjectToHistory(input);
      }
    } catch (error) {
      console.error('AI error:', error);
      setStreamingContent('');
      
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
    } finally {
      setAiLoading(false);
      setIsStreaming(false);
      setCreatedFiles([]); // Reset created files tracker
    }
  };
  
  // Save current project to history
  const saveProjectToHistory = useCallback((prompt: string) => {
    // Get current files from store
    const currentFiles = useStore.getState().files;
    if (currentFiles.length === 0) return;
    
    // Generate project name from prompt
    const projectName = prompt.slice(0, 50).trim() || 'AI Generated Project';
    
    // Create project with current files
    createProject(projectName, 'ai-generated', currentFiles);
    
    console.log(`[AI] Project saved to history: ${projectName}`);
  }, [createProject]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  const quickActions = [
    { label: '✨ Generate', prompt: 'Generate code for: ' },
    { label: '🏗️ Build App', prompt: 'Build a complete app: ' },
    { label: '🔧 Fix Error', prompt: 'Fix this error: ' },
    { label: '📝 Explain', prompt: 'Explain this code: ' },
    { label: '🔄 Refactor', prompt: 'Refactor this code to: ' },
    { label: '🧪 Add Tests', prompt: 'Write tests for: ' },
    { label: '📖 Document', prompt: 'Add documentation to: ' },
    { label: '🚀 Deploy', prompt: 'Help me deploy: ' },
  ];

  // Render markdown content
  const renderContent = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children }) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match;
          
          if (isInline) {
            return (
              <code className={`${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-200'} px-1 py-0.5 rounded text-sm`}>
                {children}
              </code>
            );
          }
          
          return (
            <div className={`relative mt-2 rounded-lg overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'}`}>
              <div className={`flex items-center justify-between px-3 py-1 ${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'} text-xs`}>
                <span className={mutedTextClass}>{match[1]}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(String(children))}
                  className={`${mutedTextClass} hover:text-white transition-colors`}
                >
                  📋 Copy
                </button>
              </div>
              <pre className="p-3 overflow-x-auto text-sm">
                <code className={className}>
                  {children}
                </code>
              </pre>
            </div>
          );
        },
        p({ children }) {
          return <p className="mb-2 leading-relaxed">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
        },
        h1({ children }) {
          return <h1 className="text-xl font-bold mb-2">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-lg font-bold mb-2">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-base font-bold mb-1">{children}</h3>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className={`flex flex-col h-full ${bgClass}`}>
      {/* Header with Status */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${borderClass}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className={`font-semibold ${textClass}`}>AI Agent</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            connectionStatus === 'connected' 
              ? 'bg-green-500/20 text-green-400' 
              : connectionStatus === 'connecting'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
          }`}>
            {connectionStatus === 'connected' ? '● Live' : connectionStatus === 'connecting' ? '○ Connecting...' : '○ Offline'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowActionsDropdown(!showActionsDropdown)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${mutedTextClass} hover:bg-slate-700 hover:text-white`}
              title="Quick Actions"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showActionsDropdown && (
              <div className={`absolute right-0 mt-1 w-48 rounded-lg shadow-xl z-50 py-1 ${theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-200'}`}>
                {quickActions.map((action) => (
                  <button
                    key={`action-${action.label}`}
                    onClick={() => {
                      setInput(action.prompt);
                      setShowActionsDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700 hover:text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Clear Chat */}
          <button
            onClick={clearChat}
            className={`p-2 rounded-lg transition-colors ${mutedTextClass} hover:bg-slate-700 hover:text-white`}
            title="Clear Chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 && !streamingContent ? (
          <div className={`text-center py-12 ${mutedTextClass}`}>
            <div className="text-5xl mb-4">🤖</div>
            <p className="text-base font-medium">AI Agent Ready</p>
            <p className="text-sm mt-2 opacity-70">I can generate, edit, and build entire applications</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {['Build a React app', 'Create an API', 'Fix my code'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className={`px-3 py-1.5 text-xs rounded-full ${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {chatHistory.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm
                  ${message.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                  {message.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3
                  ${message.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-sm' 
                    : theme === 'dark' ? 'bg-slate-700 text-slate-100 rounded-bl-sm' : 'bg-gray-200 text-gray-800 rounded-bl-sm'}`}>
                  <div className="text-sm">
                    {message.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      renderContent(message.content)
                    )}
                  </div>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <span className="text-xs opacity-70">
                        📎 {message.attachments.map(a => a.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Streaming response */}
            {streamingContent && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm">
                  🤖
                </div>
                <div className={`max-w-[85%] ${theme === 'dark' ? 'bg-slate-700 text-slate-100' : 'bg-gray-200 text-gray-800'} rounded-2xl rounded-bl-sm px-4 py-3`}>
                  <div className="text-sm">
                    {renderContent(streamingContent)}
                    <span className="inline-block w-2 h-4 ml-1 bg-emerald-500 animate-pulse" />
                  </div>
                </div>
              </div>
            )}
            
            {/* Created files indicator */}
            {createdFiles.length > 0 && (
              <div className={`mx-4 p-3 rounded-xl ${theme === 'dark' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-emerald-500">📁</span>
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    Files Created ({createdFiles.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {createdFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className={`text-xs px-2 py-1 rounded-md ${theme === 'dark' ? 'bg-slate-700 text-emerald-300' : 'bg-white text-emerald-700 border border-emerald-200'}`}
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        {isAiLoading && !streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm">
              🤖
            </div>
            <div className={`${theme === 'dark' ? 'bg-slate-700' : 'bg-gray-200'} rounded-2xl rounded-bl-sm px-4 py-3`}>
              <div className="flex gap-1">
                <div className={`w-2 h-2 ${theme === 'dark' ? 'bg-slate-400' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
                <div className={`w-2 h-2 ${theme === 'dark' ? 'bg-slate-400' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
                <div className={`w-2 h-2 ${theme === 'dark' ? 'bg-slate-400' : 'bg-gray-400'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context indicator */}
      {activeFile && (
        <div className={`px-4 py-2 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-gray-100 border-gray-200'} border-t`}>
          <div className={`flex items-center gap-3 text-xs ${mutedTextClass}`}>
            <span className="flex items-center gap-1">
              <span>📎</span>
              <span className="text-indigo-500 font-medium">{activeFile.name}</span>
            </span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className={`p-4 border-t ${borderClass}`}>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "🎤 Listening..." : "Ask AI to build, edit, or explain anything..."}
              rows={3}
              disabled={isStreaming}
              className={`w-full px-4 py-3 ${inputBgClass} border ${borderClass} rounded-xl ${textClass} text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${isListening ? 'border-red-500 animate-pulse' : ''} disabled:opacity-50`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSend}
              disabled={!input.trim() || isAiLoading || isStreaming}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              title="Send"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
            <button
              onClick={handleVoiceInput}
              className={`p-3 rounded-xl transition-colors ${isListening ? 'bg-red-600 text-white animate-pulse' : theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
              title={isListening ? "Stop Listening" : "Voice Input"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgenticAIChat;
