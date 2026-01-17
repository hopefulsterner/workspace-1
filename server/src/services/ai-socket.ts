import { Socket } from 'socket.io';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const gemini = process.env.GOOGLE_AI_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
  : null;

export function setupAISocket(socket: Socket) {
  // Streaming chat
  socket.on('ai:chat:stream', async (data: {
    messages: Array<{ role: string; content: string }>;
    provider: string;
    model?: string;
  }) => {
    try {
      const { messages, provider, model } = data;
      
      if (provider === 'openai' && openai) {
        const stream = await openai.chat.completions.create({
          model: model || 'gpt-4-turbo-preview',
          messages: messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
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
        
        const chat = genModel.startChat({
          history: messages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        });
        
        const result = await chat.sendMessageStream(messages[messages.length - 1].content);
        
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
}
