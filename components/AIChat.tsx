import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { ChatMessage } from '../types';
import { voiceInput, voiceOutput, speechSupport } from '../services/speech';
import { aiService } from '../services/ai';

export const AIChat: React.FC = () => {
  const { 
    chatHistory, 
    addMessage, 
    clearChat, 
    aiConfig,
    isAiLoading,
    setAiLoading,
    openFiles,
    activeFileId,
    theme
  } = useStore();
  
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeFile = openFiles.find(f => f.id === activeFileId);
  
  // Theme classes
  const bgClass = theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50';
  const borderClass = theme === 'dark' ? 'border-slate-700' : 'border-gray-200';
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const mutedTextClass = theme === 'dark' ? 'text-slate-400' : 'text-gray-500';
  const inputBgClass = theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

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

  // Speak response handler
  const handleSpeak = (text: string) => {
    if (!speechSupport.synthesis) return;
    
    voiceOutput.speak(text, {
      rate: 1,
      pitch: 1,
      onEnd: () => {},
      onError: () => {},
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isAiLoading) return;

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

    try {
      // Prepare message with context
      let fullMessage = input;
      if (activeFile) {
        fullMessage += `\n\n[Current file: ${activeFile.name}]\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\``;
      }

      // Vision analysis - prepared for future use with vision-capable APIs
      // Currently not used in the basic sendMessage call
      // let imageData;
      // if (capturedImage) {
      //   const prepared = await visionAnalysis.prepareForAI(capturedImage);
      //   imageData = { base64: prepared.base64, mimeType: prepared.mimeType };
      // }

      // Build message for AI
      const userMsgForAI: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: fullMessage,
        timestamp: Date.now(),
      };
      
      // Use the AI service with internal API key
      const aiResponse = await aiService.sendMessage(aiConfig, [...chatHistory, userMsgForAI], fullMessage);
      
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: aiResponse.content,
        timestamp: Date.now(),
      };
      addMessage(assistantMessage);
      
      // Auto-speak if enabled
      if (voiceEnabled && speechSupport.synthesis) {
        handleSpeak(aiResponse.content);
      }
    } catch (error) {
      console.error('AI error:', error);
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: Date.now(),
      };
      addMessage(errorMessage);
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  const quickActions = [
    { label: '✨ Generate', prompt: 'Generate code for: ' },
    { label: '🔧 Fix Error', prompt: 'Fix this error: ' },
    { label: '📝 Explain', prompt: 'Explain this code: ' },
    { label: '🔄 Refactor', prompt: 'Refactor this code to: ' },
    { label: '🧪 Add Tests', prompt: 'Write tests for: ' },
    { label: '📖 Document', prompt: 'Add documentation to: ' },
  ];

  return (
    <div className={`flex flex-col h-full ${bgClass}`}>
      {/* Header with Actions Dropdown */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${borderClass}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className={`font-semibold ${textClass}`}>AI Assistant</span>
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
        {chatHistory.length === 0 ? (
          <div className={`text-center py-12 ${mutedTextClass}`}>
            <div className="text-5xl mb-4">🤖</div>
            <p className="text-base font-medium">Start a conversation with AI</p>
            <p className="text-sm mt-2 opacity-70">Ask me to generate, explain, or fix code</p>
          </div>
        ) : (
          chatHistory.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm
                ${message.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                {message.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5
                ${message.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-sm' 
                  : theme === 'dark' ? 'bg-slate-700 text-slate-100 rounded-bl-sm' : 'bg-gray-200 text-gray-800 rounded-bl-sm'}`}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <span className="text-xs opacity-70">
                      📎 {message.attachments.map(a => a.name).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isAiLoading && (
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
              placeholder={isListening ? "🎤 Listening..." : "Ask AI anything... (Shift+Enter for new line)"}
              rows={3}
              className={`w-full px-4 py-3 ${inputBgClass} border ${borderClass} rounded-xl ${textClass} text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${isListening ? 'border-red-500 animate-pulse' : ''}`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSend}
              disabled={!input.trim() || isAiLoading}
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
