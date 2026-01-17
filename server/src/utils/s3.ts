import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// S3 Configuration
const s3Config = {
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
};

const s3Client = new S3Client(s3Config);
const BUCKET = process.env.S3_BUCKET || 'victorykit';

// Media type detection
export function getMediaType(mimeType: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'OTHER' {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'DOCUMENT';
  return 'OTHER';
}

// Generate a unique S3 key
export function generateS3Key(originalName: string, folder: string = 'uploads'): string {
  const ext = path.extname(originalName) || '.png';
  const timestamp = Date.now();
  const uniqueId = uuidv4().slice(0, 8);
  return `${folder}/${timestamp}-${uniqueId}${ext}`;
}

// Upload file to S3
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  mimeType: string,
  metadata?: Record<string, string>
): Promise<{ url: string; key: string; bucket: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    Metadata: metadata,
    // Note: ACL removed because bucket has "bucket owner enforced" setting
    // Public access is controlled via bucket policy instead
  });

  await s3Client.send(command);

  // Generate public URL
  const url = `https://${BUCKET}.s3.${s3Config.region}.amazonaws.com/${key}`;

  return {
    url,
    key,
    bucket: BUCKET,
  };
}

// Upload base64 data to S3
export async function uploadBase64ToS3(
  base64Data: string,
  filename: string,
  mimeType: string,
  folder: string = 'uploads'
): Promise<{ url: string; key: string; bucket: string; size: number }> {
  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  
  const key = generateS3Key(filename, folder);
  const result = await uploadToS3(buffer, key, mimeType);
  
  return {
    ...result,
    size: buffer.length,
  };
}

// Get signed URL for private files
export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Get signed URL for uploads (presigned PUT)
export async function getSignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn: number = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
    // Note: ACL removed because bucket has "bucket owner enforced" setting
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

// Delete file from S3
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

// Check if S3 is configured
export function isS3Configured(): boolean {
  return !!(process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_BUCKET);
}

export { s3Client, BUCKET };
