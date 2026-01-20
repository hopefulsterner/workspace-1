import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import { uploadBase64ToS3, getMediaType, isS3Configured } from '../utils/s3';

const router = Router();

// Lazy initialize OpenAI client
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }
  return openai;
}

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB limit for DALL-E
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG images are supported for DALL-E editing'));
    }
  },
});

// Check if AI image generation is available
router.get('/status', (req: Request, res: Response) => {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  
  res.json({
    available: hasOpenAI,
    models: hasOpenAI ? ['dall-e-3', 'dall-e-2'] : [],
    limits: {
      maxImages: 4,
      maxSize: '1792x1024',
    },
  });
});

// Generate image using DALL-E
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      negative_prompt,
      model = 'dall-e-3',
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      n = 1,
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    console.log(`[AI Image] Generating with ${model}: "${prompt.substring(0, 50)}..."`);

    // Build enhanced prompt with negative prompt
    let enhancedPrompt = prompt;
    if (negative_prompt && model === 'dall-e-3') {
      enhancedPrompt = `${prompt}. Avoid: ${negative_prompt}`;
    }

    // DALL-E 3 only supports n=1
    const actualN = model === 'dall-e-3' ? 1 : Math.min(n, 4);

    const response = await getOpenAI().images.generate({
      model,
      prompt: enhancedPrompt,
      n: actualN,
      size: size as any,
      quality: model === 'dall-e-3' ? quality : undefined,
      style: model === 'dall-e-3' ? style : undefined,
      response_format: 'url',
    });

    const images = await Promise.all(
      (response.data || []).map(async (img, index) => {
        let savedUrl = img.url;

        // Optionally save to S3 if configured
        if (isS3Configured() && img.url) {
          try {
            // Fetch the image and upload to S3
            const imageResponse = await fetch(img.url);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(imageBuffer).toString('base64');
            const dataUrl = `data:image/png;base64,${base64}`;
            
            const s3Result = await uploadBase64ToS3(
              dataUrl,
              `ai-generated-${Date.now()}-${index}.png`,
              'image/png',
              'ai-generated'
            );
            savedUrl = s3Result.url;
          } catch (s3Error) {
            console.error('[AI Image] Failed to save to S3:', s3Error);
            // Keep using OpenAI URL as fallback
          }
        }

        return {
          url: savedUrl,
          revisedPrompt: img.revised_prompt,
          model,
          size,
          createdAt: Date.now(),
        };
      })
    );

    console.log(`[AI Image] Generated ${images.length} image(s)`);

    res.json({
      success: true,
      images,
    });
  } catch (error: any) {
    console.error('[AI Image] Generation error:', error);
    
    // Handle OpenAI specific errors
    if (error.code === 'content_policy_violation') {
      return res.status(400).json({
        error: 'Your prompt was rejected due to content policy. Please modify your prompt.',
      });
    }
    
    if (error.code === 'rate_limit_exceeded') {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to generate image',
    });
  }
});

// Edit image (inpainting) using DALL-E 2
router.post('/edit', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mask', maxCount: 1 },
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const imageFile = files?.image?.[0];
    const maskFile = files?.mask?.[0];
    
    const { prompt, size = '1024x1024', n = 1 } = req.body;

    if (!imageFile) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    console.log(`[AI Image] Editing image: "${prompt.substring(0, 50)}..."`);

    // Create File objects from buffers
    const imageBlob = new Blob([imageFile.buffer], { type: 'image/png' });
    const image = new File([imageBlob], 'image.png', { type: 'image/png' });

    let mask: File | undefined;
    if (maskFile) {
      const maskBlob = new Blob([maskFile.buffer], { type: 'image/png' });
      mask = new File([maskBlob], 'mask.png', { type: 'image/png' });
    }

    const response = await getOpenAI().images.edit({
      model: 'dall-e-2',
      image,
      mask,
      prompt,
      n: Math.min(parseInt(n), 4),
      size: size as any,
      response_format: 'url',
    });

    const images = (response.data || []).map((img, index) => ({
      url: img.url,
      model: 'dall-e-2',
      size,
      createdAt: Date.now(),
    }));

    console.log(`[AI Image] Edited ${images.length} image(s)`);

    res.json({
      success: true,
      images,
    });
  } catch (error: any) {
    console.error('[AI Image] Edit error:', error);
    res.status(500).json({
      error: error.message || 'Failed to edit image',
    });
  }
});

// Create image variations using DALL-E 2
router.post('/variation', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const imageFile = req.file;
    const { size = '1024x1024', n = 1 } = req.body;

    if (!imageFile) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    console.log('[AI Image] Creating variations');

    // Create File object from buffer
    const imageBlob = new Blob([imageFile.buffer], { type: 'image/png' });
    const image = new File([imageBlob], 'image.png', { type: 'image/png' });

    const response = await getOpenAI().images.createVariation({
      model: 'dall-e-2',
      image,
      n: Math.min(parseInt(n), 4),
      size: size as any,
      response_format: 'url',
    });

    const images = (response.data || []).map((img, index) => ({
      url: img.url,
      model: 'dall-e-2',
      size,
      createdAt: Date.now(),
    }));

    console.log(`[AI Image] Created ${images.length} variation(s)`);

    res.json({
      success: true,
      images,
    });
  } catch (error: any) {
    console.error('[AI Image] Variation error:', error);
    res.status(500).json({
      error: error.message || 'Failed to create variation',
    });
  }
});

export default router;
