import { AIProvider, AIConfig, ChatMessage, MessageAttachment } from '../types';

// AI Service - Multi-provider support
export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIStreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

// Provider-specific API configurations
const PROVIDER_CONFIGS: Record<AIProvider, { baseUrl: string; models: string[] }> = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
  ollama: {
    baseUrl: 'http://localhost:11434/api',
    models: ['llama3.2', 'codellama', 'mistral', 'deepseek-coder'],
  },
  custom: {
    baseUrl: '',
    models: [],
  },
};

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || 'https://maula.dev/api';

// Internal API key - users don't need to configure this
// In production, this should be handled by a backend proxy
const INTERNAL_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// System prompt for coding assistant
const SYSTEM_PROMPT = `You are an expert AI coding assistant in the "AI Digital Friend Zone" IDE. You help developers:

1. **Generate Code**: Create complete, production-ready code based on descriptions
2. **Fix Errors**: Debug and fix issues in existing code
3. **Explain Code**: Provide clear explanations of code functionality
4. **Refactor**: Improve code quality, performance, and readability
5. **Write Tests**: Generate comprehensive test cases

When generating code:
- Always provide complete, runnable code
- Include necessary imports
- Add helpful comments
- Follow best practices for the language/framework
- Use modern syntax and patterns

When the user shares a file, analyze it in context of their question.
Format code blocks with the appropriate language identifier.`;

// Try to use backend API first, fallback to direct API calls
async function sendViaBackend(
  provider: string,
  model: string,
  messages: ChatMessage[],
  temperature: number
): Promise<AIResponse | null> {
  try {
    console.log('[AI Service] Calling backend API:', API_URL);
    
    // Always use openai provider for backend since it has API keys configured
    const response = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
          content: m.content,
        })),
        provider: 'openai', // Force openai since server has the key
        model: 'gpt-4o-mini',
        temperature,
      }),
    });
    
    console.log('[AI Service] Backend response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('[AI Service] Backend response:', data);
      if (data.response) {
        return { content: data.response };
      }
    } else {
      const errorText = await response.text();
      console.error('[AI Service] Backend error:', errorText);
    }
    return null;
  } catch (error) {
    console.error('[AI Service] Backend API not available:', error);
    return null;
  }
}

export const aiService = {
  // Get available models for a provider
  getModels: (provider: AIProvider): string[] => {
    return PROVIDER_CONFIGS[provider]?.models || [];
  },

  // Send message to AI (non-streaming)
  sendMessage: async (
    config: AIConfig,
    messages: ChatMessage[],
    context?: string
  ): Promise<AIResponse> => {
    const { provider, model, baseUrl, temperature, maxTokens } = config;
    
    // Try backend API first (server has API keys configured)
    const backendResponse = await sendViaBackend(provider, model, messages, temperature);
    if (backendResponse) {
      return backendResponse;
    }
    
    // Fallback to direct API calls if backend not available
    // Use internal API key if user hasn't provided one
    const apiKey = config.apiKey || INTERNAL_API_KEY;

    if (!apiKey && provider !== 'ollama') {
      // Return a helpful message when no API key is available
      return {
        content: `I'm ready to help! To enable AI responses, please ask your administrator to configure the API key. In the meantime, I can still help you with:\n\n• Code templates and examples\n• Project setup guidance\n• General programming questions\n\nJust describe what you need!`,
      };
    }

    switch (provider) {
      case 'gemini':
        return sendToGemini(apiKey!, model, messages, temperature, maxTokens, context);
      case 'openai':
        return sendToOpenAI(apiKey!, model, messages, temperature, maxTokens, context);
      case 'claude':
        return sendToClaude(apiKey!, model, messages, temperature, maxTokens, context);
      case 'ollama':
        return sendToOllama(baseUrl || PROVIDER_CONFIGS.ollama.baseUrl, model, messages, temperature, context);
      case 'custom':
        return sendToCustom(baseUrl!, apiKey, model, messages, temperature, maxTokens, context);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  },

  // Stream message from AI
  streamMessage: async (
    config: AIConfig,
    messages: ChatMessage[],
    callbacks: AIStreamCallbacks,
    context?: string
  ): Promise<void> => {
    const { provider, model, apiKey, baseUrl, temperature, maxTokens } = config;

    if (!apiKey && provider !== 'ollama') {
      callbacks.onError(new Error(`API key required for ${provider}`));
      return;
    }

    try {
      switch (provider) {
        case 'gemini':
          await streamFromGemini(apiKey!, model, messages, callbacks, temperature, maxTokens, context);
          break;
        case 'openai':
          await streamFromOpenAI(apiKey!, model, messages, callbacks, temperature, maxTokens, context);
          break;
        case 'claude':
          await streamFromClaude(apiKey!, model, messages, callbacks, temperature, maxTokens, context);
          break;
        case 'ollama':
          await streamFromOllama(baseUrl || PROVIDER_CONFIGS.ollama.baseUrl, model, messages, callbacks, temperature, context);
          break;
        default:
          callbacks.onError(new Error(`Streaming not supported for ${provider}`));
      }
    } catch (error) {
      callbacks.onError(error as Error);
    }
  },
};

// ============ GEMINI ============
async function sendToGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  context?: string
): Promise<AIResponse> {
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + (context ? `\n\nCurrent file context:\n${context}` : '') }] },
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    usage: data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount || 0,
      completionTokens: data.usageMetadata.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata.totalTokenCount || 0,
    } : undefined,
  };
}

async function streamFromGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  callbacks: AIStreamCallbacks,
  temperature: number,
  maxTokens: number,
  context?: string
): Promise<void> {
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT + (context ? `\n\nCurrent file context:\n${context}` : '') }] },
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          fullResponse += text;
          callbacks.onToken(text);
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }

  callbacks.onComplete(fullResponse);
}

// ============ OPENAI ============
async function sendToOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  context?: string
): Promise<AIResponse> {
  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT + (context ? `\n\nCurrent file context:\n${context}` : '') },
    ...messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

async function streamFromOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  callbacks: AIStreamCallbacks,
  temperature: number,
  maxTokens: number,
  context?: string
): Promise<void> {
  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT + (context ? `\n\nCurrent file context:\n${context}` : '') },
    ...messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content || '';
        if (text) {
          fullResponse += text;
          callbacks.onToken(text);
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  callbacks.onComplete(fullResponse);
}

// ============ CLAUDE ============
async function sendToClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  context?: string
): Promise<AIResponse> {
  const formattedMessages = messages.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT + (context ? `\n\nCurrent file context:\n${context}` : ''),
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Claude API error');
  }

  const data = await response.json();
  return {
    content: data.content?.[0]?.text || '',
    usage: data.usage ? {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    } : undefined,
  };
}

async function streamFromClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  callbacks: AIStreamCallbacks,
  temperature: number,
  maxTokens: number,
  context?: string
): Promise<void> {
  const formattedMessages = messages.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: SYSTEM_PROMPT + (context ? `\n\nCurrent file context:\n${context}` : ''),
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Claude API error');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'content_block_delta') {
          const text = data.delta?.text || '';
          if (text) {
            fullResponse += text;
            callbacks.onToken(text);
          }
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  callbacks.onComplete(fullResponse);
}

// ============ OLLAMA ============
async function sendToOllama(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  context?: string
): Promise<AIResponse> {
  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT + (context ? `\n\nCurrent file context:\n${context}` : '') },
    ...messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      stream: false,
      options: { temperature },
    }),
  });

  if (!response.ok) {
    throw new Error('Ollama API error');
  }

  const data = await response.json();
  return {
    content: data.message?.content || '',
  };
}

async function streamFromOllama(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  callbacks: AIStreamCallbacks,
  temperature: number,
  context?: string
): Promise<void> {
  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT + (context ? `\n\nCurrent file context:\n${context}` : '') },
    ...messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      stream: true,
      options: { temperature },
    }),
  });

  if (!response.ok) {
    throw new Error('Ollama API error');
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        const text = data.message?.content || '';
        if (text) {
          fullResponse += text;
          callbacks.onToken(text);
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  callbacks.onComplete(fullResponse);
}

// ============ CUSTOM ============
async function sendToCustom(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  context?: string
): Promise<AIResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + (context ? `\n\nCurrent file context:\n${context}` : '') },
        ...messages.map(msg => ({ role: msg.role, content: msg.content })),
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error('Custom API error');
  }

  const data = await response.json();
  
  // Try to extract content from common response formats
  const content = 
    data.choices?.[0]?.message?.content || // OpenAI format
    data.content?.[0]?.text || // Claude format
    data.response || // Simple format
    data.message?.content || // Ollama format
    '';

  return { content };
}
