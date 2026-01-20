import { Router } from 'express';
import multer from 'multer';
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

    const { data, filename, mimeType, source = 'UPLOAD' } = req.body;

    if (!data || !filename || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields: data, filename, mimeType' });
    }

    // Determine folder based on source
    const folder = source === 'SCREENSHOT' ? 'screenshots' 
                 : source === 'CAMERA' ? 'camera' 
                 : 'uploads';

    // Upload to S3
    const s3Result = await uploadBase64ToS3(data, filename, mimeType, folder);

    console.log('[Media] Uploaded:', s3Result.url);

    res.status(201).json({
      success: true,
      media: {
        id: s3Result.key,
        url: s3Result.url,
        filename: s3Result.key.split('/').pop() || filename,
        mimeType,
        size: s3Result.size,
        type: getMediaType(mimeType),
        source,
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

// List recent public media (returns empty - no DB storage)
router.get('/recent', async (req, res) => {
  res.json({ media: [] });
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

    const { source = 'UPLOAD' } = req.body;
    const file = req.file;

    // Upload to S3
    const key = generateS3Key(file.originalname, 'uploads');
    const s3Result = await uploadToS3(file.buffer, key, file.mimetype);

    res.status(201).json({
      success: true,
      media: {
        id: key,
        url: s3Result.url,
        filename: key.split('/').pop() || file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  } catch (error: any) {
    console.error('[Media] Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload media' });
  }
});

// Get user's media (returns empty - no DB storage)
router.get('/my', async (req, res) => {
  res.json({ media: [] });
});

// Delete media
router.delete('/:id', async (req, res) => {
  try {
    const key = req.params.id;
    
    // Delete from S3
    await deleteFromS3(key);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

export default router;
