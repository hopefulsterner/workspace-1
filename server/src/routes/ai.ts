import { Router } from 'express';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const gemini = process.env.GOOGLE_AI_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
  : null;

// System prompt for the AI assistant - AGENTIC with file operations
const SYSTEM_PROMPT = `You are an expert AI coding assistant in the "AI Digital Friend Zone" IDE with FULL access to create, modify, and delete files.

## Your Capabilities:
1. **Create Files**: You can create new files with complete code
2. **Edit Files**: You can modify existing files  
3. **Delete Files**: You can remove files when needed
4. **Build Projects**: You can scaffold entire applications from scratch

## CRITICAL - You MUST use these XML tags to perform file operations:

### Create a new file:
<file_create path="src/components/MyComponent.tsx">
// Complete file content here
import React from 'react';

export const MyComponent = () => {
  return <div>Hello World</div>;
};
</file_create>

### Edit/Replace a file:
<file_edit path="src/App.tsx">
// Complete new file content
</file_edit>

### Delete a file:
<file_delete path="src/old-file.ts" />

## IMPORTANT RULES:
1. ALWAYS use the XML tags above when creating or modifying files - this is how files get created!
2. Provide COMPLETE, working code - never use placeholders like "..." or "// rest of code"
3. Include ALL necessary imports
4. Create ALL files needed for the feature to work
5. When building a project, create files in logical order (config first, then components)
6. Use modern best practices (React 18+, TypeScript, Tailwind CSS)

## Example - When user says "create a React counter component":

I'll create a counter component for you.

<file_create path="src/components/Counter.tsx">
import React, { useState } from 'react';

interface CounterProps {
  initialValue?: number;
}

export const Counter: React.FC<CounterProps> = ({ initialValue = 0 }) => {
  const [count, setCount] = useState(initialValue);

  return (
    <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg">
      <button
        onClick={() => setCount(c => c - 1)}
        className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded text-white"
      >
        -
      </button>
      <span className="text-2xl font-bold text-white">{count}</span>
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-green-500 hover:bg-green-600 rounded text-white"
      >
        +
      </button>
    </div>
  );
};

export default Counter;
</file_create>

The Counter component is ready! It includes increment/decrement buttons with Tailwind styling.

Remember: WITHOUT the <file_create> tags, files will NOT be created. Always use them!`;

// Public chat endpoint (no auth required) - rate limited per IP
router.post('/chat', async (req, res) => {
  try {
    const { messages, provider = 'openai', model, temperature = 0.7 } = req.body;
    
    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    
    let response: string;
    
    // Try OpenAI first (best quality)
    if ((provider === 'openai' || !provider) && openai) {
      const completion = await openai.chat.completions.create({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.map((m: any) => ({
            role: m.role === 'model' ? 'assistant' : m.role,
            content: m.content,
          })),
        ],
        temperature,
        max_tokens: 4096,
      });
      response = completion.choices[0].message.content || '';
    } 
    // Try Anthropic Claude
    else if (provider === 'anthropic' && anthropic) {
      const message = await anthropic.messages.create({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: messages.map((m: any) => ({
          role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      });
      response = message.content[0].type === 'text' ? message.content[0].text : '';
    }
    // Fallback to Gemini
    else if (provider === 'gemini' && gemini) {
      const genModel = gemini.getGenerativeModel({ model: model || 'gemini-pro' });
      const chat = genModel.startChat({
        history: messages.slice(0, -1).map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: [{ text: m.content }],
        })),
      });
      const result = await chat.sendMessage(messages[messages.length - 1].content);
      response = result.response.text();
    } 
    // No provider available - try any available
    else {
      // Auto-select available provider
      if (openai) {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.map((m: any) => ({
              role: m.role === 'model' ? 'assistant' : m.role,
              content: m.content,
            })),
          ],
          temperature,
          max_tokens: 4096,
        });
        response = completion.choices[0].message.content || '';
      } else if (anthropic) {
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: messages.map((m: any) => ({
            role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        });
        response = message.content[0].type === 'text' ? message.content[0].text : '';
      } else {
        return res.status(400).json({ error: 'No AI provider configured on server' });
      }
    }
    
    res.json({ response });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'AI request failed' });
  }
});

// Protected routes below require authentication
router.use(authMiddleware);

// Chat completion (authenticated - with usage tracking)
router.post('/chat-auth', async (req, res) => {
  try {
    const { messages, provider = 'openai', model, temperature = 0.7 } = req.body;
    
    // Track usage
    await prisma.usage.create({
      data: {
        userId: req.userId!,
        type: 'AI_REQUEST',
        metadata: { provider, model },
      },
    });
    
    let response: string;
    
    if (provider === 'openai' && openai) {
      const completion = await openai.chat.completions.create({
        model: model || 'gpt-4-turbo-preview',
        messages: messages.map((m: any) => ({
          role: m.role === 'model' ? 'assistant' : m.role,
          content: m.content,
        })),
        temperature,
      });
      response = completion.choices[0].message.content || '';
    } else if (provider === 'gemini' && gemini) {
      const genModel = gemini.getGenerativeModel({ model: model || 'gemini-pro' });
      const chat = genModel.startChat({
        history: messages.slice(0, -1).map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: [{ text: m.content }],
        })),
      });
      const result = await chat.sendMessage(messages[messages.length - 1].content);
      response = result.response.text();
    } else {
      return res.status(400).json({ error: 'AI provider not configured' });
    }
    
    res.json({ response });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'AI request failed' });
  }
});

// Code generation
router.post('/generate', async (req, res) => {
  try {
    const { prompt, language, context } = req.body;
    
    const systemPrompt = `You are an expert ${language || 'JavaScript'} developer. Generate clean, well-documented code based on the user's request. Only output the code, no explanations.`;
    
    const fullPrompt = context 
      ? `Context:\n${context}\n\nRequest: ${prompt}`
      : prompt;
    
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullPrompt },
        ],
      });
      
      const response = completion.choices[0].message.content || '';
      const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1] : response;
      
      res.json({ code: code.trim() });
    } else if (gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent([systemPrompt, fullPrompt]);
      const response = result.response.text();
      
      // Extract code from markdown if present
      const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1] : response;
      
      res.json({ code: code.trim() });
    } else {
      res.status(400).json({ error: 'No AI provider configured' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Code generation failed' });
  }
});

// Explain code
router.post('/explain', async (req, res) => {
  try {
    const { code, language } = req.body;
    
    const prompt = `Explain this ${language || ''} code in simple terms:\n\n${code}`;
    
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      res.json({ explanation: result.response.text() });
    } else if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
      });
      res.json({ explanation: completion.choices[0].message.content });
    } else {
      res.status(400).json({ error: 'No AI provider configured' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Explanation failed' });
  }
});

// Fix code
router.post('/fix', async (req, res) => {
  try {
    const { code, error: codeError, language } = req.body;
    
    const prompt = `Fix this ${language || ''} code that has the following error:\n\nError: ${codeError}\n\nCode:\n${code}\n\nProvide only the fixed code.`;
    
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      res.json({ fixedCode: (codeMatch ? codeMatch[1] : response).trim() });
    } else if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
      });
      const response = completion.choices[0].message.content || '';
      const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      res.json({ fixedCode: (codeMatch ? codeMatch[1] : response).trim() });
    } else {
      res.status(400).json({ error: 'No AI provider configured' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Fix failed' });
  }
});

export default router;
