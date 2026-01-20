import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '../store/useStore';
import { ChatMessage } from '../types';
import { voiceInput, voiceOutput, speechSupport } from '../services/speech';
import { aiAgentService, FileOperation } from '../services/aiAgent';
import { socketService } from '../services/socket';
import { StreamingParser, StreamingFileOperation, StreamingCommand } from '../services/streamingParser';
import { webContainerService } from '../services/webcontainer';

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
    updateFileContent,
    currentProject,
    createProject,
    setCurrentProject,
  } = useStore();
  
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [currentStreamingFile, setCurrentStreamingFile] = useState<StreamingFileOperation | null>(null);
  const [createdFilesCount, setCreatedFilesCount] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{name: string, content: string, type: string, isImage?: boolean}>>([]);
  const [webContainerStatus, setWebContainerStatus] = useState<'idle' | 'booting' | 'installing' | 'running' | 'error'>('idle');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('orchestrator');
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [agentStatus, setAgentStatus] = useState<{status: string; agent: string; message?: string} | null>(null);
  
  // Available agents
  const AGENTS = [
    { id: 'orchestrator', name: 'Orchestrator', icon: '🎯', description: 'Auto-delegates to best agent' },
    { id: 'code-generation', name: 'Code Gen', icon: '💻', description: 'Creates new code' },
    { id: 'refactor', name: 'Refactor', icon: '🔧', description: 'Improves code' },
    { id: 'debug', name: 'Debug', icon: '🐛', description: 'Finds bugs' },
    { id: 'test', name: 'Test', icon: '🧪', description: 'Writes tests' },
    { id: 'build', name: 'Build', icon: '📦', description: 'Build config' },
    { id: 'deploy', name: 'Deploy', icon: '🚀', description: 'Deployment' },
    { id: 'filesystem', name: 'Files', icon: '📁', description: 'File ops' },
    { id: 'ui', name: 'UI', icon: '🎨', description: 'UI components' },
    { id: 'documentation', name: 'Docs', icon: '📝', description: 'Documentation' },
  ];
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const parserRef = useRef<StreamingParser | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

  // Helper to get language from file extension
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescript', 'js': 'javascript', 'jsx': 'javascript',
      'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json', 'md': 'markdown',
    };
    return map[ext] || 'plaintext';
  };

  // Create file immediately when streaming starts
  const handleFileStart = useCallback((file: StreamingFileOperation) => {
    console.log('[AI] 📄 File started:', file.path);
    setCurrentStreamingFile(file);
    
    // Create folders if needed
    const pathParts = file.path.split('/');
    const fileName = pathParts.pop() || file.path;
    const parentPath = pathParts.join('/');
    
    if (parentPath) {
      let currentPath = '';
      for (const folder of pathParts) {
        const folderPath = currentPath ? `${currentPath}/${folder}` : folder;
        createFolder(currentPath, folder);
        currentPath = folderPath;
      }
    }
    
    // Create the file immediately with empty/partial content
    createFile(parentPath, fileName, file.content || '// Loading...');
    
    // Open the file in editor
    const fileId = crypto.randomUUID();
    openFile({
      id: fileId,
      name: fileName,
      path: file.path,
      content: file.content || '// Loading...',
      language: getLanguage(file.path),
      isDirty: true,
    });
  }, [createFile, createFolder, openFile]);

  // Update file content as it streams
  const handleFileProgress = useCallback((file: StreamingFileOperation) => {
    // Update the file content in real-time
    if (file.content) {
      updateFileContent(file.path, file.content);
    }
  }, [updateFileContent]);

  // Finalize file when complete
  const handleFileComplete = useCallback((file: StreamingFileOperation) => {
    console.log('[AI] ✅ File completed:', file.path);
    setCurrentStreamingFile(null);
    setCreatedFilesCount(prev => prev + 1);
    
    // Final update with complete content
    if (file.content) {
      updateFileContent(file.path, file.content);
    }
    
    // Also call the external handler if provided
    if (onFileOperation) {
      onFileOperation({
        type: file.type as 'create' | 'edit' | 'delete',
        path: file.path,
        content: file.content,
      });
    }
  }, [updateFileContent, onFileOperation]);

  // Handle terminal command from AI
  const handleTerminalCommand = useCallback((command: string) => {
    console.log('[AI] Terminal command:', command);
    if (onTerminalCommand) {
      onTerminalCommand(command);
    }
  }, [onTerminalCommand]);

  // Handle WebContainer commands from AI
  const handleCommand = useCallback(async (command: StreamingCommand) => {
    console.log('[AI] 🔧 Command:', command);
    
    try {
      switch (command.type) {
        case 'install':
          setWebContainerStatus('installing');
          // First mount all files to WebContainer
          if (files.length > 0) {
            await webContainerService.writeFiles(files);
          }
          // Then run npm install
          const installResult = await webContainerService.runCommand('npm', ['install']);
          if (installResult.exitCode === 0) {
            console.log('[AI] ✅ Dependencies installed');
          }
          break;
          
        case 'start':
          setWebContainerStatus('running');
          // Mount files first
          if (files.length > 0) {
            await webContainerService.writeFiles(files);
          }
          // Start dev server
          const serverResult = await webContainerService.startDevServer('npm', ['start']);
          if (serverResult.url) {
            setServerUrl(serverResult.url);
            console.log('[AI] 🚀 Server started at:', serverResult.url);
          }
          break;
          
        case 'rebuild':
          setWebContainerStatus('installing');
          await webContainerService.writeFiles(files);
          await webContainerService.runCommand('npm', ['run', 'build']);
          break;
          
        case 'terminal':
          if (command.command) {
            const parts = command.command.split(' ');
            await webContainerService.runCommand(parts[0], parts.slice(1));
          }
          break;
      }
    } catch (error) {
      console.error('[AI] Command error:', error);
      setWebContainerStatus('error');
    }
  }, [files]);

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

  // File upload handler
  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newUploadedFiles: Array<{name: string, content: string, type: string, isImage?: boolean}> = [];

    for (const file of Array.from(files)) {
      try {
        const isImage = file.type.startsWith('image/');
        if (isImage) {
          // Read images as base64 data URL
          const content = await readFileAsBase64(file);
          newUploadedFiles.push({
            name: file.name,
            content,
            type: file.type,
            isImage: true,
          });
        } else {
          // Read text files as text
          const content = await readFileAsText(file);
          newUploadedFiles.push({
            name: file.name,
            content,
            type: file.type || 'text/plain',
            isImage: false,
          });
        }
      } catch (error) {
        console.error(`Failed to read file ${file.name}:`, error);
      }
    }

    setUploadedFiles(prev => [...prev, ...newUploadedFiles]);
    
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
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

  // Send message with REAL-TIME streaming
  const handleSend = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isAiLoading || isStreaming) return;

    // Separate images from text files
    const imageFiles = uploadedFiles.filter(f => f.isImage);
    const textFiles = uploadedFiles.filter(f => !f.isImage);

    // Build display message for chat history
    let displayMessage = input;
    if (textFiles.length > 0) {
      const fileContents = textFiles.map(file => 
        `\n\n📎 **Attached file: ${file.name}**\n\`\`\`\n${file.content}\n\`\`\``
      ).join('');
      displayMessage = (input || 'Here are some files:') + fileContents;
    }
    if (imageFiles.length > 0) {
      displayMessage = (displayMessage || 'Analyze this image:') + `\n\n🖼️ **${imageFiles.length} image(s) attached**`;
    }
    
    // Add agent tag if not orchestrator
    const agentLabel = selectedAgent !== 'orchestrator' 
      ? `\n\n🤖 *Using: ${AGENTS.find(a => a.id === selectedAgent)?.name || selectedAgent} agent*`
      : '';

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: displayMessage + agentLabel,
      timestamp: Date.now(),
      attachments: imageFiles.map(f => ({
        type: 'image' as const,
        name: f.name,
        content: f.content,
        mimeType: f.type,
      })),
    };

    addMessage(userMessage);
    setInput('');
    const currentUploadedFiles = [...uploadedFiles]; // Save before clearing
    setUploadedFiles([]); // Clear uploaded files after sending
    setAiLoading(true);
    setIsStreaming(true);
    setStreamingContent('');
    setCreatedFilesCount(0);
    setAgentStatus(selectedAgent !== 'orchestrator' ? { status: 'working', agent: selectedAgent } : null);

    // Initialize streaming parser with real-time callbacks
    parserRef.current = new StreamingParser({
      onFileStart: handleFileStart,
      onFileProgress: handleFileProgress,
      onFileComplete: handleFileComplete,
      onCommand: handleCommand,
    });

    try {
      // Prepare text content
      let textContent = input;
      
      // Add text file contents
      if (textFiles.length > 0) {
        const fileContents = textFiles.map(file => 
          `\n\n📎 **Attached file: ${file.name}**\n\`\`\`\n${file.content}\n\`\`\``
        ).join('');
        textContent = (input || 'Here are some files:') + fileContents;
      }

      // Add current file context
      if (activeFile) {
        textContent += `\n\n[Current file: ${activeFile.name}]\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\``;
      }
      
      // Add context about existing files
      if (files.length > 0) {
        const projectContext = files.map(f => {
          if (f.type === 'file' && f.content) {
            const truncatedContent = f.content.length > 1500 
              ? f.content.substring(0, 1500) + '\n... (truncated)'
              : f.content;
            return `[File: ${f.path}]\n\`\`\`\n${truncatedContent}\n\`\`\``;
          }
          return f.type === 'folder' ? `[Folder: ${f.path}]` : `[File: ${f.path}]`;
        }).join('\n\n');
        textContent += `\n\n--- PROJECT FILES ---\n${projectContext}\n--- END ---`;
      }

      // Build messages for AI - with image support
      const messagesForAI = chatHistory.map(m => {
        // Check if message has image attachments
        if (m.attachments?.some(a => a.type === 'image')) {
          return {
            role: m.role as 'user' | 'assistant',
            content: m.content,
            images: m.attachments.filter(a => a.type === 'image').map(a => a.content),
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      });

      // Add current message with images
      if (imageFiles.length > 0) {
        messagesForAI.push({
          role: 'user' as const,
          content: textContent || 'Analyze this image and help me build what you see:',
          images: imageFiles.map(f => f.content),
        });
      } else {
        messagesForAI.push({
          role: 'user' as const,
          content: textContent,
        });
      }

      // Stream via WebSocket
      if (socketService.isConnected()) {
        await new Promise<void>((resolve, reject) => {
          aiAgentService.streamChat(
            messagesForAI,
            {
              onToken: (token) => {
                // Process token through streaming parser
                const displayContent = parserRef.current?.processToken(token) || '';
                setStreamingContent(displayContent);
              },
              onComplete: (response) => {
                setStreamingContent('');
                setIsStreaming(false);
                setAgentStatus(null);
                
                const assistantMessage: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: response,
                  timestamp: Date.now(),
                };
                addMessage(assistantMessage);
                
                // Reset parser
                parserRef.current?.reset();
                
                if (externalVoiceEnabled && speechSupport.synthesis) {
                  handleSpeak(response);
                }
                
                resolve();
              },
              onError: (error) => {
                reject(error);
              },
              onFileOperation: (op) => {
                // Backup handler for any missed operations
                console.log('[AI] Backup file operation:', op);
              },
              onTerminalCommand: handleTerminalCommand,
            },
            'openai',
            'gpt-4o-mini'
          );
        });
      } else {
        // Fallback to REST API
        const result = await aiAgentService.sendMessage(messagesForAI, 'openai', 'gpt-4o-mini');
        
        // Process file operations
        result.operations.forEach(op => {
          handleFileStart({ type: op.type as any, path: op.path, content: op.content, isComplete: true });
          handleFileComplete({ type: op.type as any, path: op.path, content: op.content, isComplete: true });
        });
        
        result.commands.forEach(handleTerminalCommand);
        
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.response,
          timestamp: Date.now(),
        };
        addMessage(assistantMessage);
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
      setCurrentStreamingFile(null);
      setAgentStatus(null);
      parserRef.current?.reset();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    { label: '✨ Generate', prompt: 'Generate code for: ' },
    { label: '🏗️ Build App', prompt: 'Build a complete app: ' },
    { label: '🔧 Fix Error', prompt: 'Fix this error: ' },
    { label: '📝 Explain', prompt: 'Explain this code: ' },
  ];

  // Render markdown content
  const renderContent = (content: string) => {
    // Clean file operation tags for display
    const cleanContent = content
      .replace(/<dyad-write[^>]*>[\s\S]*?<\/dyad-write>/gi, '\n✅ File created\n')
      .replace(/<file_create[^>]*>[\s\S]*?<\/file_create>/gi, '\n✅ File created\n')
      .replace(/<dyad-search-replace[^>]*>[\s\S]*?<\/dyad-search-replace>/gi, '\n✅ File updated\n')
      .replace(/<file_edit[^>]*>[\s\S]*?<\/file_edit>/gi, '\n✅ File updated\n')
      .replace(/<dyad-delete[^>]*>[\s\S]*?<\/dyad-delete>/gi, '\n🗑️ File deleted\n')
      .replace(/<file_delete[^>]*\/?>/gi, '\n🗑️ File deleted\n');
    
    return (
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
                  <code className={className}>{children}</code>
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
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    );
  };

  return (
    <div className={`flex flex-col h-full ${bgClass}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${borderClass}`}>
        <div className="flex items-center gap-3">
          <div className="text-2xl">🤖</div>
          <div>
            <h2 className={`font-semibold ${textClass}`}>Maula AI</h2>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`} />
              <span className={`text-xs ${mutedTextClass}`}>
                {connectionStatus === 'connected' ? 'Ready' : connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={clearChat}
          className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'} transition-colors`}
          title="Clear Chat"
        >
          🗑️
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.length === 0 && !isStreaming && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👋</div>
            <h3 className={`text-xl font-semibold ${textClass} mb-2`}>How can I help you?</h3>
            <p className={mutedTextClass}>I can create apps, write code, and help you build projects.</p>
            
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => setInput(action.prompt)}
                  className={`px-4 py-2 rounded-lg text-sm ${
                    theme === 'dark' 
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  } transition-colors`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-900'
            }`}>
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {renderContent(msg.content)}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Streaming content */}
        {isStreaming && (
          <div className="flex justify-start">
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-900'
            }`}>
              {/* Active agent indicator */}
              {agentStatus && (
                <div className={`flex items-center gap-2 mb-3 p-2 rounded-lg ${
                  theme === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100'
                }`}>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                  <span className="text-sm">
                    {AGENTS.find(a => a.id === agentStatus.agent)?.icon || '🤖'} 
                    <span className="font-medium ml-1">{AGENTS.find(a => a.id === agentStatus.agent)?.name || 'Agent'}</span>
                    <span className="ml-2 opacity-70">{agentStatus.message || 'Working...'}</span>
                  </span>
                </div>
              )}
              
              {/* Currently streaming file indicator */}
              {currentStreamingFile && (
                <div className={`flex items-center gap-2 mb-3 p-2 rounded-lg ${
                  theme === 'dark' ? 'bg-indigo-900/50' : 'bg-indigo-100'
                }`}>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                  <span className="text-sm">
                    {currentStreamingFile.type === 'create' ? '📄 Creating' : '✏️ Editing'}: 
                    <code className="ml-1 font-mono text-indigo-400">{currentStreamingFile.path}</code>
                  </span>
                </div>
              )}
              
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {renderContent(streamingContent || '...')}
              </div>
              
              {/* Files created counter */}
              {createdFilesCount > 0 && (
                <div className={`mt-2 text-xs ${mutedTextClass}`}>
                  ✅ {createdFilesCount} file{createdFilesCount > 1 ? 's' : ''} created
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={`p-4 border-t ${borderClass}`}>
        {/* Uploaded files preview */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {file.isImage ? (
                  <img 
                    src={file.content} 
                    alt={file.name} 
                    className="w-8 h-8 object-cover rounded"
                  />
                ) : (
                  <span>📎</span>
                )}
                <span className="max-w-32 truncate">{file.name}</span>
                <button
                  onClick={() => removeUploadedFile(index)}
                  className={`ml-1 hover:text-red-500 transition-colors`}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className={`flex items-end gap-2 p-2 rounded-xl ${inputBgClass} border`}>
          {/* Hidden file input - accepts both text and image files */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelected}
            className="hidden"
            accept=".txt,.js,.ts,.tsx,.jsx,.py,.json,.html,.css,.md,.yaml,.yml,.xml,.csv,.sql,.sh,.bash,.env,.gitignore,.dockerfile,Dockerfile,.toml,.ini,.cfg,image/*,.png,.jpg,.jpeg,.gif,.webp,.svg"
          />
          
          {/* Agent selector button */}
          <div className="relative">
            <button
              onClick={() => setShowAgentSelector(!showAgentSelector)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-sm ${
                theme === 'dark' ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-gray-100 text-gray-600'
              } ${selectedAgent !== 'orchestrator' ? 'ring-1 ring-indigo-500' : ''}`}
              title={`Current: ${AGENTS.find(a => a.id === selectedAgent)?.name || 'Orchestrator'}`}
            >
              <span>{AGENTS.find(a => a.id === selectedAgent)?.icon || '🎯'}</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {/* Agent dropdown */}
            {showAgentSelector && (
              <div className={`absolute bottom-full left-0 mb-2 w-56 rounded-lg shadow-xl border ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
              } max-h-80 overflow-y-auto z-50`}>
                <div className={`px-3 py-2 text-xs font-semibold ${mutedTextClass} border-b ${borderClass}`}>
                  Select Agent
                </div>
                {AGENTS.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgent(agent.id);
                      setShowAgentSelector(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${
                      selectedAgent === agent.id
                        ? 'bg-indigo-600 text-white'
                        : theme === 'dark' ? 'hover:bg-slate-700 text-slate-200' : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="text-lg">{agent.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{agent.name}</div>
                      <div className={`text-xs truncate ${
                        selectedAgent === agent.id ? 'text-white/70' : mutedTextClass
                      }`}>{agent.description}</div>
                    </div>
                    {selectedAgent === agent.id && (
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* File upload button */}
          <button
            onClick={handleFileUpload}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
            }`}
            title="Upload files or images"
            disabled={isAiLoading || isStreaming}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              uploadedFiles.length > 0 
                ? "Add a message about these files..." 
                : selectedAgent === 'orchestrator'
                  ? "Ask me to build something..."
                  : `Ask ${AGENTS.find(a => a.id === selectedAgent)?.name || 'agent'}...`
            }
            className={`flex-1 resize-none bg-transparent outline-none ${textClass} placeholder:${mutedTextClass}`}
            rows={1}
            style={{ minHeight: '24px', maxHeight: '200px' }}
            disabled={isAiLoading || isStreaming}
          />
          
          <div className="flex items-center gap-1">
            {speechSupport.recognition && (
              <button
                onClick={handleVoiceInput}
                className={`p-2 rounded-lg transition-colors ${
                  isListening 
                    ? 'bg-red-500 text-white' 
                    : theme === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                🎤
              </button>
            )}
            
            <button
              onClick={handleSend}
              disabled={(!input.trim() && uploadedFiles.length === 0) || isAiLoading || isStreaming}
              className={`p-2 rounded-lg transition-colors ${
                (input.trim() || uploadedFiles.length > 0) && !isAiLoading && !isStreaming
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : theme === 'dark' ? 'bg-slate-700 text-slate-500' : 'bg-gray-200 text-gray-400'
              }`}
            >
              {isAiLoading || isStreaming ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                '➤'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgenticAIChat;
