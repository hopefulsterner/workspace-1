import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AIImageService {
  private openai: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ai.openai.apiKey');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      throw new BadRequestException('OpenAI not configured. Set OPENAI_API_KEY.');
    }
    return this.openai;
  }

  async getStatus() {
    return {
      available: !!this.openai,
      models: this.openai ? ['dall-e-3', 'dall-e-2'] : [],
    };
  }

  async generateImage(options: {
    prompt: string;
    model?: string;
    size?: string;
    quality?: string;
    style?: string;
    n?: number;
  }) {
    const openai = this.getOpenAI();

    const response = await openai.images.generate({
      model: options.model || 'dall-e-3',
      prompt: options.prompt,
      n: options.n || 1,
      size: (options.size as any) || '1024x1024',
      quality: (options.quality as any) || 'standard',
      style: (options.style as any) || 'vivid',
      response_format: 'url',
    });

    return {
      success: true,
      images: (response.data || []).map(img => ({
        url: img.url,
        revisedPrompt: img.revised_prompt,
      })),
    };
  }

  async editImage(options: {
    image: string;
    mask?: string;
    prompt: string;
    size?: string;
    n?: number;
  }) {
    const openai = this.getOpenAI();

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(options.image, 'base64');
    const imageFile = new File([imageBuffer], 'image.png', { type: 'image/png' });

    const params: any = {
      model: 'dall-e-2',
      image: imageFile,
      prompt: options.prompt,
      n: options.n || 1,
      size: (options.size as any) || '1024x1024',
      response_format: 'url',
    };

    if (options.mask) {
      const maskBuffer = Buffer.from(options.mask, 'base64');
      params.mask = new File([maskBuffer], 'mask.png', { type: 'image/png' });
    }

    const response = await openai.images.edit(params);

    return {
      success: true,
      images: (response.data || []).map(img => ({
        url: img.url,
      })),
    };
  }

  async createVariation(options: {
    image: string;
    n?: number;
    size?: string;
  }) {
    const openai = this.getOpenAI();

    const imageBuffer = Buffer.from(options.image, 'base64');
    const imageFile = new File([imageBuffer], 'image.png', { type: 'image/png' });

    const response = await openai.images.createVariation({
      model: 'dall-e-2',
      image: imageFile,
      n: options.n || 1,
      size: (options.size as any) || '1024x1024',
      response_format: 'url',
    });

    return {
      success: true,
      images: (response.data || []).map(img => ({
        url: img.url,
      })),
    };
  }
}
