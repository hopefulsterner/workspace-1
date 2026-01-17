// Media Service - Upload and manage media files
const API_URL = import.meta.env.VITE_API_URL || 'https://maula.dev/api';

export interface MediaUploadResult {
  success: boolean;
  media?: {
    id: string;
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    type: string;
    source: string;
  };
  error?: string;
}

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type: string;
  source: string;
  createdAt: string;
}

// Check if media service is available
export async function checkMediaStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/media/status`);
    const data = await response.json();
    return data.available === true;
  } catch {
    return false;
  }
}

// Upload base64 image data (for screenshots and camera captures)
export async function uploadBase64Media(
  base64Data: string,
  filename: string,
  mimeType: string,
  source: 'UPLOAD' | 'SCREENSHOT' | 'CAMERA' | 'AI_GENERATED' = 'UPLOAD',
  projectId?: string
): Promise<MediaUploadResult> {
  try {
    const response = await fetch(`${API_URL}/media/upload/base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: base64Data,
        filename,
        mimeType,
        source,
        projectId,
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { success: false, error: result.error || 'Upload failed' };
    }

    return result;
  } catch (error: any) {
    console.error('[Media Service] Upload error:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

// Upload a File object
export async function uploadFile(
  file: File,
  source: 'UPLOAD' | 'SCREENSHOT' | 'CAMERA' = 'UPLOAD',
  projectId?: string,
  authToken?: string
): Promise<MediaUploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source', source);
    if (projectId) formData.append('projectId', projectId);

    const headers: HeadersInit = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { success: false, error: result.error || 'Upload failed' };
    }

    return result;
  } catch (error: any) {
    console.error('[Media Service] Upload error:', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
}

// Convert canvas/blob to base64
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Upload from canvas element
export async function uploadFromCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  source: 'SCREENSHOT' | 'CAMERA' = 'SCREENSHOT',
  projectId?: string
): Promise<MediaUploadResult> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve({ success: false, error: 'Failed to create image blob' });
        return;
      }

      const base64 = await blobToBase64(blob);
      const result = await uploadBase64Media(base64, filename, 'image/png', source, projectId);
      resolve(result);
    }, 'image/png');
  });
}

// Get recent media
export async function getRecentMedia(
  limit: number = 20,
  type?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
): Promise<MediaItem[]> {
  try {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (type) params.append('type', type);

    const response = await fetch(`${API_URL}/media/recent?${params}`);
    const data = await response.json();
    return data.media || [];
  } catch (error) {
    console.error('[Media Service] Fetch error:', error);
    return [];
  }
}

// Helper: Download media URL as file
export function downloadMedia(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Helper: Copy URL to clipboard
export async function copyMediaUrl(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export const mediaService = {
  checkStatus: checkMediaStatus,
  uploadBase64: uploadBase64Media,
  uploadFile,
  uploadFromCanvas,
  blobToBase64,
  getRecent: getRecentMedia,
  download: downloadMedia,
  copyUrl: copyMediaUrl,
};
