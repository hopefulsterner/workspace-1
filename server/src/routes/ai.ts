import { Router } from 'express';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();
router.use(authMiddleware);

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const gemini = process.env.GOOGLE_AI_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
  : null;

// Chat completion
router.post('/chat', async (req, res) => {
  try {
    const { messages, provider = 'gemini', model, temperature = 0.7 } = req.body;
    
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
    
    if (gemini) {
      const model = gemini.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent([systemPrompt, fullPrompt]);
      const response = result.response.text();
      
      // Extract code from markdown if present
      const codeMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1] : response;
      
      res.json({ code: code.trim() });
    } else if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullPrompt },
        ],
      });
      
      const response = completion.choices[0].message.content || '';
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
