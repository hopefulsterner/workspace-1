// Camera & Vision Service - WebRTC camera capture and image analysis

export interface CameraConfig {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
  frameRate?: number;
}

export interface CapturedImage {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  timestamp: number;
}

// Check browser support
export const cameraSupport = {
  mediaDevices: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  screenCapture: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia,
};

let activeStream: MediaStream | null = null;
let videoElement: HTMLVideoElement | null = null;

export const camera = {
  isSupported: (): boolean => cameraSupport.mediaDevices,
  
  isActive: (): boolean => activeStream !== null,

  // Start camera stream
  start: async (config?: CameraConfig): Promise<MediaStream> => {
    if (!cameraSupport.mediaDevices) {
      throw new Error('Camera not supported in this browser');
    }

    // Stop existing stream
    camera.stop();

    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: config?.width || 1280 },
        height: { ideal: config?.height || 720 },
        facingMode: config?.facingMode || 'user',
        frameRate: { ideal: config?.frameRate || 30 },
      },
      audio: false,
    };

    try {
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('📷 Camera started');
      return activeStream;
    } catch (error) {
      console.error('📷 Camera error:', error);
      throw error;
    }
  },

  // Stop camera stream
  stop: (): void => {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      activeStream = null;
      console.log('📷 Camera stopped');
    }
  },

  // Get current stream
  getStream: (): MediaStream | null => activeStream,

  // Attach stream to video element
  attachToVideo: (video: HTMLVideoElement): void => {
    if (activeStream) {
      video.srcObject = activeStream;
      videoElement = video;
    }
  },

  // Capture frame from video
  captureFrame: (video?: HTMLVideoElement, format: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/jpeg', quality = 0.9): Promise<CapturedImage> => {
    return new Promise((resolve, reject) => {
      const targetVideo = video || videoElement;
      
      if (!targetVideo || !targetVideo.videoWidth) {
        reject(new Error('No video source available'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetVideo.videoWidth;
      canvas.height = targetVideo.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(targetVideo, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to capture frame'));
            return;
          }

          const dataUrl = canvas.toDataURL(format, quality);
          
          resolve({
            dataUrl,
            blob,
            width: canvas.width,
            height: canvas.height,
            timestamp: Date.now(),
          });
        },
        format,
        quality
      );
    });
  },

  // List available cameras
  listDevices: async (): Promise<MediaDeviceInfo[]> => {
    if (!cameraSupport.mediaDevices) {
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  },
};

// Screen capture
export const screenCapture = {
  isSupported: (): boolean => cameraSupport.screenCapture,

  // Capture screen
  capture: async (options?: {
    video?: boolean;
    audio?: boolean;
    preferCurrentTab?: boolean;
  }): Promise<MediaStream> => {
    if (!cameraSupport.screenCapture) {
      throw new Error('Screen capture not supported in this browser');
    }

    const constraints: any = {
      video: options?.video !== false,
      audio: options?.audio || false,
    };

    if (options?.preferCurrentTab) {
      constraints.video = { displaySurface: 'browser' };
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      console.log('🖥️ Screen capture started');
      return stream;
    } catch (error) {
      console.error('🖥️ Screen capture error:', error);
      throw error;
    }
  },

  // Take screenshot
  takeScreenshot: async (format: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png', quality = 0.9): Promise<CapturedImage> => {
    const stream = await screenCapture.capture({ video: true });
    
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        video.play();
        
        // Wait a frame for video to render
        setTimeout(async () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }

            ctx.drawImage(video, 0, 0);

            // Stop stream
            stream.getTracks().forEach(track => track.stop());

            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to capture screenshot'));
                  return;
                }

                const dataUrl = canvas.toDataURL(format, quality);
                
                resolve({
                  dataUrl,
                  blob,
                  width: canvas.width,
                  height: canvas.height,
                  timestamp: Date.now(),
                });
              },
              format,
              quality
            );
          } catch (error) {
            stream.getTracks().forEach(track => track.stop());
            reject(error);
          }
        }, 100);
      };

      video.onerror = () => {
        stream.getTracks().forEach(track => track.stop());
        reject(new Error('Video playback error'));
      };
    });
  },
};

// Image utilities
export const imageUtils = {
  // Convert blob to base64
  blobToBase64: (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Extract base64 part
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  // Load image from URL or file
  loadImage: (source: string | File): Promise<CapturedImage> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      const process = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to process image'));
            return;
          }

          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            blob,
            width: canvas.width,
            height: canvas.height,
            timestamp: Date.now(),
          });
        });
      };

      img.onload = process;
      img.onerror = () => reject(new Error('Failed to load image'));

      if (source instanceof File) {
        img.src = URL.createObjectURL(source);
      } else {
        img.crossOrigin = 'anonymous';
        img.src = source;
      }
    });
  },

  // Resize image
  resize: (image: CapturedImage, maxWidth: number, maxHeight: number): Promise<CapturedImage> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to resize image'));
            return;
          }

          resolve({
            dataUrl: canvas.toDataURL('image/jpeg', 0.9),
            blob,
            width,
            height,
            timestamp: Date.now(),
          });
        });
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = image.dataUrl;
    });
  },
};

// Vision analysis integration helpers
export const visionAnalysis = {
  // Prepare image for AI vision API (resize if needed, convert to base64)
  prepareForAI: async (image: CapturedImage, maxSize = 1024): Promise<{
    base64: string;
    mimeType: string;
    width: number;
    height: number;
  }> => {
    // Resize if too large
    let processedImage = image;
    if (image.width > maxSize || image.height > maxSize) {
      processedImage = await imageUtils.resize(image, maxSize, maxSize);
    }

    // Convert to base64
    const base64 = await imageUtils.blobToBase64(processedImage.blob);

    return {
      base64,
      mimeType: processedImage.blob.type || 'image/jpeg',
      width: processedImage.width,
      height: processedImage.height,
    };
  },

  // Build message with image for various AI providers
  buildImageMessage: (base64: string, mimeType: string, prompt: string): {
    gemini: any;
    openai: any;
    claude: any;
  } => {
    return {
      // Gemini format
      gemini: {
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64,
              }
            }
          ]
        }]
      },

      // OpenAI format
      openai: {
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              }
            }
          ]
        }]
      },

      // Claude format
      claude: {
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64,
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      },
    };
  },
};
