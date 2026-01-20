import { Socket } from 'socket.io';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import langchainService, { AgentType } from './langchain';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const gemini = process.env.GOOGLE_AI_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
  : null;

// Cerebras uses OpenAI-compatible API
const cerebras = process.env.CEREBRAS_API_KEY
  ? new OpenAI({ 
      apiKey: process.env.CEREBRAS_API_KEY,
      baseURL: 'https://api.cerebras.ai/v1'
    })
  : null;

// Multi-agent orchestrator instances per socket
const orchestrators = new Map<string, InstanceType<typeof langchainService.AgentOrchestrator>>();

// Interface for chat messages with vision support
interface ChatMessage {
  role: string;
  content: string;
  images?: string[];  // Base64 data URLs for images
}

// AGENTIC SYSTEM PROMPT - Instructs AI to CREATE files, not just explain
const AGENTIC_SYSTEM_PROMPT = `You are an expert AI coding agent that BUILDS applications in real-time. You work inside an AI IDE similar to Bolt.new, Cursor, or Lovable.

## YOUR PRIMARY FUNCTION:
When the user asks you to build something, you MUST create the actual files using XML tags. DO NOT just explain how to do it - ACTUALLY DO IT.

## MULTI-AGENT SYSTEM:
You are the Orchestrator Agent and can delegate to specialized agents:
- **code-generation**: Creates new files and components
- **refactor**: Improves existing code structure and performance  
- **debug**: Finds and fixes bugs
- **test**: Writes comprehensive test suites
- **build**: Configures webpack, vite, package.json, docker
- **deploy**: Handles deployment to cloud platforms
- **filesystem**: Manages files and directories
- **ui**: Creates beautiful React components with Tailwind
- **documentation**: Writes README, API docs, comments

To delegate, use: <delegate agent="agent-name">specific task</delegate>

## CRITICAL - You MUST use these XML tags to perform file operations:

### Creating Files (MOST IMPORTANT):
<file_create path="src/components/MyComponent.tsx">
// The COMPLETE file content goes here
import React from 'react';

export const MyComponent = () => {
  return <div>Hello World</div>;
};
</file_create>

### Editing Existing Files:
<file_edit path="src/App.tsx">
// The COMPLETE new file content (full replacement)
</file_edit>

### Deleting Files:
<file_delete path="src/oldFile.ts" />

## RULES:
1. ALWAYS use <file_create> tags when creating new files - this is how files appear in the file explorer
2. Include COMPLETE, working code - no placeholders, no "// TODO", no "// add more here"
3. Include ALL necessary imports
4. Create ALL files needed for the feature to work
5. Use proper file paths starting from src/ or root
6. After creating files, briefly explain what you built

## EXAMPLE - If user says "create a counter component":

I'll create a Counter component for you.

<file_create path="src/components/Counter.tsx">
import React, { useState } from 'react';

interface CounterProps {
  initialValue?: number;
}

export const Counter: React.FC<CounterProps> = ({ initialValue = 0 }) => {
  const [count, setCount] = useState(initialValue);

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg">
      <button
        onClick={() => setCount(c => c - 1)}
        className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded text-white font-bold"
      >
        -
      </button>
      <span className="text-2xl font-bold text-white">{count}</span>
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded text-white font-bold"
      >
        +
      </button>
    </div>
  );
};
</file_create>

I've created a Counter component with increment/decrement buttons and styled it with Tailwind CSS.

## REMEMBER:
- WITHOUT the <file_create> tags, files will NOT be created in the IDE
- You are an AGENT that EXECUTES actions, not a chatbot that explains things
- When in doubt, CREATE THE FILES
- Be proactive - if building a feature requires multiple files, create all of them`;

export function setupAISocket(socket: Socket) {
  // Streaming chat with VISION support
  socket.on('ai:chat:stream', async (data: {
    messages: ChatMessage[];
    provider: string;
    model?: string;
  }) => {
    try {
      const { messages, provider, model } = data;
      
      // Check if any messages have images
      const hasImages = messages.some(m => m.images && m.images.length > 0);
      
      // Prepend the agentic system prompt
      const systemMessage: ChatMessage = { role: 'system', content: AGENTIC_SYSTEM_PROMPT };
      const messagesWithSystem: ChatMessage[] = [systemMessage, ...messages];
      
      if (provider === 'openai' && openai) {
        // Build messages with proper vision format for OpenAI
        const formattedMessages = messagesWithSystem.map((m: ChatMessage) => {
          // Check if message has images
          if (m.images && m.images.length > 0) {
            // Build content array with text and images
            const content: Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> = [
              { type: 'text', text: m.content || 'Analyze this image and help me build what you see:' }
            ];
            
            // Add each image
            for (const imageDataUrl of m.images) {
              content.push({
                type: 'image_url',
                image_url: {
                  url: imageDataUrl,
                  detail: 'high',
                },
              });
            }
            
            return {
              role: m.role as 'user' | 'assistant' | 'system',
              content,
            };
          }
          
          // Regular text message
          return {
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          };
        });

        // Use GPT-4o for vision, otherwise use specified model
        const selectedModel = hasImages ? 'gpt-4o' : (model || 'gpt-4o-mini');
        console.log(`[AI Socket] Using model: ${selectedModel}, hasImages: ${hasImages}`);

        const stream = await openai.chat.completions.create({
          model: selectedModel,
          messages: formattedMessages as any,
          stream: true,
          max_tokens: 4096,
        });
        
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            socket.emit('ai:chat:chunk', { content });
          }
        }
        
        socket.emit('ai:chat:done');
      } else if (provider === 'cerebras' && cerebras) {
        // Cerebras uses OpenAI-compatible API with Llama models
        const stream = await cerebras.chat.completions.create({
          model: model || 'llama-3.3-70b',
          messages: [
            { role: 'system', content: AGENTIC_SYSTEM_PROMPT },
            ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
          ],
          stream: true,
        });
        
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            socket.emit('ai:chat:chunk', { content });
          }
        }
        
        socket.emit('ai:chat:done');
      } else if (provider === 'gemini' && gemini) {
        const genModel = gemini.getGenerativeModel({ model: model || 'gemini-pro' });
        
        // For Gemini, include system prompt in the first user message
        const geminiMessages = messages.map((m, i) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: i === 0 && m.role === 'user' 
            ? `${AGENTIC_SYSTEM_PROMPT}\n\n---\n\nUser Request: ${m.content}` 
            : m.content }],
        }));
        
        const chat = genModel.startChat({
          history: geminiMessages.slice(0, -1),
        });
        
        const lastMessage = messages[messages.length - 1];
        const result = await chat.sendMessageStream(
          messages.length === 1 
            ? `${AGENTIC_SYSTEM_PROMPT}\n\n---\n\nUser Request: ${lastMessage.content}`
            : lastMessage.content
        );
        
        for await (const chunk of result.stream) {
          const content = chunk.text();
          if (content) {
            socket.emit('ai:chat:chunk', { content });
          }
        }
        
        socket.emit('ai:chat:done');
      } else {
        socket.emit('ai:chat:error', { error: 'AI provider not configured' });
      }
    } catch (error: any) {
      socket.emit('ai:chat:error', { error: error.message });
    }
  });
  
  // Code completion (for inline suggestions)
  socket.on('ai:complete', async (data: {
    prefix: string;
    suffix: string;
    language: string;
  }) => {
    try {
      const { prefix, suffix, language } = data;
      
      const prompt = `Complete this ${language} code. Only provide the completion, no explanation.

${prefix}[CURSOR]${suffix}

Provide only what goes at [CURSOR]:`;
      
      if (gemini) {
        const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const completion = result.response.text().trim();
        socket.emit('ai:complete:result', { completion });
      } else if (openai) {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.3,
        });
        const completion = response.choices[0].message.content?.trim() || '';
        socket.emit('ai:complete:result', { completion });
      }
    } catch (error: any) {
      socket.emit('ai:complete:error', { error: error.message });
    }
  });

  // ============================================
  // MULTI-AGENT SYSTEM HANDLERS
  // ============================================

  // Initialize or get orchestrator for this socket
  const getOrchestrator = () => {
    if (!orchestrators.has(socket.id)) {
      orchestrators.set(socket.id, new langchainService.AgentOrchestrator('openai'));
    }
    return orchestrators.get(socket.id)!;
  };

  // Multi-agent orchestrated chat (non-streaming)
  socket.on('ai:agent:chat', async (data: {
    message: string;
    projectContext?: string;
    agentType?: AgentType;
  }) => {
    try {
      const { message, projectContext, agentType } = data;
      const orchestrator = getOrchestrator();

      let response: string;
      
      if (agentType && agentType !== 'orchestrator') {
        // Direct chat with specific agent
        socket.emit('ai:agent:status', { 
          status: 'working', 
          agent: agentType,
          message: `${agentType} agent is working...` 
        });
        response = await orchestrator.directChat(agentType, message, projectContext);
      } else {
        // Let orchestrator decide which agents to use
        socket.emit('ai:agent:status', { 
          status: 'analyzing', 
          agent: 'orchestrator',
          message: 'Orchestrator analyzing request...' 
        });
        response = await orchestrator.process(message, projectContext);
      }

      socket.emit('ai:agent:response', { response });
      socket.emit('ai:agent:status', { status: 'done', agent: 'orchestrator' });
    } catch (error: any) {
      socket.emit('ai:agent:error', { error: error.message });
    }
  });

  // Get list of available agents
  socket.on('ai:agent:list', () => {
    const agents = [
      { id: 'orchestrator', name: 'Orchestrator', icon: '🎯', description: 'Coordinates all agents and delegates tasks' },
      { id: 'code-generation', name: 'Code Generation', icon: '💻', description: 'Creates new files and components' },
      { id: 'refactor', name: 'Refactor', icon: '🔧', description: 'Improves code structure and performance' },
      { id: 'debug', name: 'Debug', icon: '🐛', description: 'Finds and fixes bugs' },
      { id: 'test', name: 'Test', icon: '🧪', description: 'Writes comprehensive test suites' },
      { id: 'build', name: 'Build', icon: '📦', description: 'Configures build tools and bundlers' },
      { id: 'deploy', name: 'Deploy', icon: '🚀', description: 'Handles deployment to cloud platforms' },
      { id: 'filesystem', name: 'File System', icon: '📁', description: 'Manages files and directories' },
      { id: 'ui', name: 'UI', icon: '🎨', description: 'Creates beautiful React components' },
      { id: 'documentation', name: 'Documentation', icon: '📝', description: 'Writes README and API docs' },
    ];
    socket.emit('ai:agent:list', { agents });
  });

  // Clear agent history
  socket.on('ai:agent:clear', () => {
    const orchestrator = getOrchestrator();
    orchestrator.clearAllHistory();
    socket.emit('ai:agent:cleared');
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    orchestrators.delete(socket.id);
  });
}
