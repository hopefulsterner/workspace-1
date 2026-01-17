import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../utils/prisma';
import { 
  uploadToS3, 
  uploadBase64ToS3, 
  deleteFromS3, 
  generateS3Key, 
  getMediaType,
  getSignedUploadUrl,
  isS3Configured 
} from '../utils/s3';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, and common documents
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/webm', 'video/quicktime',
      'audio/mpeg', 'audio/wav', 'audio/webm',
      'application/pdf', 'text/plain',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

// ==========================================
// PUBLIC ENDPOINTS (No auth required)
// ==========================================

// Check if media service is available
router.get('/status', (req, res) => {
  res.json({
    available: isS3Configured(),
    maxFileSize: '10MB',
    allowedTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
  });
});

// Upload media via base64 (for screenshots/camera captures) - PUBLIC
router.post('/upload/base64', async (req, res) => {
  try {
    if (!isS3Configured()) {
      return res.status(503).json({ error: 'Media storage not configured' });
    }

    const { data, filename, mimeType, source = 'UPLOAD', projectId } = req.body;

    if (!data || !filename || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields: data, filename, mimeType' });
    }

    // Determine folder based on source
    const folder = source === 'SCREENSHOT' ? 'screenshots' 
                 : source === 'CAMERA' ? 'camera' 
                 : 'uploads';

    // Upload to S3
    const s3Result = await uploadBase64ToS3(data, filename, mimeType, folder);

    // Save to database (without user association for public uploads)
    const media = await prisma.media.create({
      data: {
        filename: s3Result.key.split('/').pop() || filename,
        originalName: filename,
        mimeType,
        size: s3Result.size,
        s3Key: s3Result.key,
        s3Bucket: s3Result.bucket,
        url: s3Result.url,
        type: getMediaType(mimeType),
        source: source as any,
        projectId: projectId || null,
        metadata: {},
      },
    });

    console.log('[Media] Uploaded:', media.url);

    res.status(201).json({
      success: true,
      media: {
        id: media.id,
        url: media.url,
        filename: media.filename,
        mimeType: media.mimeType,
        size: media.size,
        type: media.type,
        source: media.source,
      },
    });
  } catch (error: any) {
    console.error('[Media] Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload media' });
  }
});

// Get presigned upload URL (for direct browser uploads) - PUBLIC
router.post('/upload/presign', async (req, res) => {
  try {
    if (!isS3Configured()) {
      return res.status(503).json({ error: 'Media storage not configured' });
    }

    const { filename, mimeType } = req.body;

    if (!filename || !mimeType) {
      return res.status(400).json({ error: 'Missing filename or mimeType' });
    }

    const key = generateS3Key(filename, 'uploads');
    const uploadUrl = await getSignedUploadUrl(key, mimeType);
    const publicUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;

    res.json({
      uploadUrl,
      key,
      publicUrl,
      expiresIn: 300, // 5 minutes
    });
  } catch (error: any) {
    console.error('[Media] Presign error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate upload URL' });
  }
});

// List recent public media
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string;

    const where: any = {};
    if (type) {
      where.type = type.toUpperCase();
    }

    const media = await prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        url: true,
        filename: true,
        mimeType: true,
        size: true,
        type: true,
        source: true,
        createdAt: true,
      },
    });

    res.json({ media });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// ==========================================
// PROTECTED ENDPOINTS (Auth required)
// ==========================================

router.use(authMiddleware);

// Upload file via multipart form
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!isS3Configured()) {
      return res.status(503).json({ error: 'Media storage not configured' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { projectId, source = 'UPLOAD' } = req.body;
    const file = req.file;

    // Upload to S3
    const key = generateS3Key(file.originalname, 'uploads');
    const s3Result = await uploadToS3(file.buffer, key, file.mimetype);

    // Save to database
    const media = await prisma.media.create({
      data: {
        filename: key.split('/').pop() || file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        s3Key: key,
        s3Bucket: s3Result.bucket,
        url: s3Result.url,
        type: getMediaType(file.mimetype),
        source: source as any,
        userId: req.userId,
        projectId: projectId || null,
        metadata: {},
      },
    });

    res.status(201).json({
      success: true,
      media: {
        id: media.id,
        url: media.url,
        filename: media.filename,
        mimeType: media.mimeType,
        size: media.size,
      },
    });
  } catch (error: any) {
    console.error('[Media] Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload media' });
  }
});

// Get user's media
router.get('/my', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const type = req.query.type as string;
    const projectId = req.query.projectId as string;

    const where: any = { userId: req.userId };
    if (type) where.type = type.toUpperCase();
    if (projectId) where.projectId = projectId;

    const media = await prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({ media });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// Delete media
router.delete('/:id', async (req, res) => {
  try {
    const media = await prisma.media.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Delete from S3
    await deleteFromS3(media.s3Key);

    // Delete from database
    await prisma.media.delete({ where: { id: media.id } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

export default router;
