// AI Image Generation Service - Generate images using AI models
const API_URL = import.meta.env.VITE_API_URL || 'https://api.maula.dev';

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  model?: 'dall-e-3' | 'dall-e-2' | 'stable-diffusion';
  size?: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  n?: number;
}

export interface ImageGenerationResult {
  success: boolean;
  images?: GeneratedImage[];
  error?: string;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

export interface GeneratedImage {
  url: string;
  base64?: string;
  revisedPrompt?: string;
  model: string;
  size: string;
  createdAt: number;
}

export interface ImageEditRequest {
  image: File | Blob;
  mask?: File | Blob;
  prompt: string;
  size?: '256x256' | '512x512' | '1024x1024';
  n?: number;
}

export interface ImageVariationRequest {
  image: File | Blob;
  size?: '256x256' | '512x512' | '1024x1024';
  n?: number;
}

class AIImageGenerationService {
  private abortController: AbortController | null = null;

  // Generate image using DALL-E
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    try {
      this.abortController = new AbortController();

      const response = await fetch(`${API_URL}/ai/image/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          model: request.model || 'dall-e-3',
          size: request.size || '1024x1024',
          quality: request.quality || 'standard',
          style: request.style || 'vivid',
          n: request.n || 1,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP error: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        images: data.images || [],
        usage: data.usage,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Generation cancelled' };
      }
      console.error('[AI Image] Generation error:', error);
      return { success: false, error: error.message || 'Failed to generate image' };
    }
  }

  // Edit image (inpainting) using DALL-E
  async editImage(request: ImageEditRequest): Promise<ImageGenerationResult> {
    try {
      this.abortController = new AbortController();

      const formData = new FormData();
      formData.append('image', request.image);
      if (request.mask) {
        formData.append('mask', request.mask);
      }
      formData.append('prompt', request.prompt);
      formData.append('size', request.size || '1024x1024');
      formData.append('n', String(request.n || 1));

      const response = await fetch(`${API_URL}/ai/image/edit`, {
        method: 'POST',
        body: formData,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP error: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        images: data.images || [],
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Edit cancelled' };
      }
      console.error('[AI Image] Edit error:', error);
      return { success: false, error: error.message || 'Failed to edit image' };
    }
  }

  // Create image variations
  async createVariation(request: ImageVariationRequest): Promise<ImageGenerationResult> {
    try {
      this.abortController = new AbortController();

      const formData = new FormData();
      formData.append('image', request.image);
      formData.append('size', request.size || '1024x1024');
      formData.append('n', String(request.n || 1));

      const response = await fetch(`${API_URL}/ai/image/variation`, {
        method: 'POST',
        body: formData,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || `HTTP error: ${response.status}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        images: data.images || [],
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Variation cancelled' };
      }
      console.error('[AI Image] Variation error:', error);
      return { success: false, error: error.message || 'Failed to create variation' };
    }
  }

  // Cancel ongoing generation
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // Check if AI image generation is available
  async checkAvailability(): Promise<{
    available: boolean;
    models: string[];
    limits?: {
      maxImages: number;
      maxSize: string;
    };
  }> {
    try {
      const response = await fetch(`${API_URL}/ai/image/status`);
      if (!response.ok) {
        return { available: false, models: [] };
      }
      return await response.json();
    } catch {
      return { available: false, models: [] };
    }
  }
}

// Singleton instance
export const aiImageService = new AIImageGenerationService();

// ==========================================
// Helper functions for image manipulation
// ==========================================

// Convert URL to base64
export async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Download generated image
export function downloadImage(url: string, filename: string = 'generated-image.png'): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Create image element from URL
export function createImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Convert image to canvas for editing
export async function imageToCanvas(
  source: string | HTMLImageElement,
  width?: number,
  height?: number
): Promise<HTMLCanvasElement> {
  const img = typeof source === 'string' ? await createImageElement(source) : source;
  
  const canvas = document.createElement('canvas');
  canvas.width = width || img.naturalWidth;
  canvas.height = height || img.naturalHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Create mask from canvas selection
export function createMaskFromSelection(
  canvas: HTMLCanvasElement,
  selection: { x: number; y: number; width: number; height: number }
): Blob {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  
  // Fill with black (masked area)
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
  
  // Clear selection area (white = area to edit)
  ctx.fillStyle = 'white';
  ctx.fillRect(selection.x, selection.y, selection.width, selection.height);
  
  return new Promise((resolve) => {
    maskCanvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png');
  }) as any;
}

export default aiImageService;
