import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatDto } from './dto/chat.dto';

@Injectable()
export class AIService {
  private openai: OpenAI | null;
  private anthropic: Anthropic | null;
  private gemini: GoogleGenerativeAI | null;

  private readonly systemPrompt = `You are an expert AI coding assistant in the "AI Digital Friend Zone" IDE with FULL access to create, modify, and delete files.

## Your Capabilities:
1. **Create Files**: You can create new files with complete code
2. **Edit Files**: You can modify existing files  
3. **Delete Files**: You can remove files when needed
4. **Build Projects**: You can scaffold entire applications from scratch

## CRITICAL - You MUST use these XML tags to perform file operations:

### Create a new file:
<file_create path="src/components/MyComponent.tsx">
// Complete file content here
</file_create>

### Edit/Replace a file:
<file_edit path="src/App.tsx">
// Complete new file content
</file_edit>

### Delete a file:
<file_delete path="src/old-file.ts" />

## IMPORTANT RULES:
1. ALWAYS use the XML tags above when creating or modifying files
2. Provide COMPLETE, working code - never use placeholders
3. Include ALL necessary imports
4. Use modern best practices (React 18+, TypeScript, Tailwind CSS)`;

  constructor(private readonly configService: ConfigService) {
    const openaiKey = this.configService.get<string>('ai.openai.apiKey');
    const anthropicKey = this.configService.get<string>('ai.anthropic.apiKey');
    const googleKey = this.configService.get<string>('ai.google.apiKey');

    this.openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
    this.anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;
    this.gemini = googleKey ? new GoogleGenerativeAI(googleKey) : null;
  }

  async chat(dto: ChatDto): Promise<string> {
    const provider = dto.provider || 'openai';

    switch (provider) {
      case 'openai':
        return this.chatWithOpenAI(dto);
      case 'anthropic':
        return this.chatWithAnthropic(dto);
      case 'google':
        return this.chatWithGemini(dto);
      default:
        throw new BadRequestException(`Unknown provider: ${provider}`);
    }
  }

  async *streamChat(dto: ChatDto): AsyncGenerator<string> {
    const provider = dto.provider || 'openai';

    switch (provider) {
      case 'openai':
        yield* this.streamWithOpenAI(dto);
        break;
      case 'anthropic':
        yield* this.streamWithAnthropic(dto);
        break;
      case 'google':
        yield* this.streamWithGemini(dto);
        break;
      default:
        throw new BadRequestException(`Unknown provider: ${provider}`);
    }
  }

  private async chatWithOpenAI(dto: ChatDto): Promise<string> {
    if (!this.openai) {
      throw new BadRequestException('OpenAI not configured');
    }

    const response = await this.openai.chat.completions.create({
      model: dto.model || 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: this.systemPrompt },
        ...dto.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      temperature: dto.temperature || 0.7,
      max_tokens: dto.maxTokens || 4096,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async *streamWithOpenAI(dto: ChatDto): AsyncGenerator<string> {
    if (!this.openai) {
      throw new BadRequestException('OpenAI not configured');
    }

    const stream = await this.openai.chat.completions.create({
      model: dto.model || 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: this.systemPrompt },
        ...dto.messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      temperature: dto.temperature || 0.7,
      max_tokens: dto.maxTokens || 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  private async chatWithAnthropic(dto: ChatDto): Promise<string> {
    if (!this.anthropic) {
      throw new BadRequestException('Anthropic not configured');
    }

    const response = await this.anthropic.messages.create({
      model: dto.model || 'claude-3-opus-20240229',
      max_tokens: dto.maxTokens || 4096,
      system: this.systemPrompt,
      messages: dto.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text : '';
  }

  private async *streamWithAnthropic(dto: ChatDto): AsyncGenerator<string> {
    if (!this.anthropic) {
      throw new BadRequestException('Anthropic not configured');
    }

    const stream = await this.anthropic.messages.stream({
      model: dto.model || 'claude-3-opus-20240229',
      max_tokens: dto.maxTokens || 4096,
      system: this.systemPrompt,
      messages: dto.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  private async chatWithGemini(dto: ChatDto): Promise<string> {
    if (!this.gemini) {
      throw new BadRequestException('Google AI not configured');
    }

    const model = this.gemini.getGenerativeModel({ model: dto.model || 'gemini-pro' });
    
    const chat = model.startChat({
      history: dto.messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = dto.messages[dto.messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
  }

  private async *streamWithGemini(dto: ChatDto): AsyncGenerator<string> {
    if (!this.gemini) {
      throw new BadRequestException('Google AI not configured');
    }

    const model = this.gemini.getGenerativeModel({ model: dto.model || 'gemini-pro' });
    
    const chat = model.startChat({
      history: dto.messages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const lastMessage = dto.messages[dto.messages.length - 1];
    const result = await chat.sendMessageStream(lastMessage.content);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  getAvailableProviders(): string[] {
    const providers: string[] = [];
    if (this.openai) providers.push('openai');
    if (this.anthropic) providers.push('anthropic');
    if (this.gemini) providers.push('google');
    return providers;
  }
}
