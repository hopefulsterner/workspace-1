// Video Processing Pipeline - High-level video editing workflow
import { ffmpegService, FFmpegProgress, ProcessingResult } from './ffmpeg';

export interface VideoProject {
  id: string;
  name: string;
  clips: VideoClip[];
  timeline: TimelineItem[];
  output: OutputSettings;
  createdAt: number;
  updatedAt: number;
}

export interface VideoClip {
  id: string;
  name: string;
  file?: File;
  url?: string;
  duration: number;
  width: number;
  height: number;
  thumbnail?: string;
}

export interface TimelineItem {
  id: string;
  clipId: string;
  startTime: number;  // Position on timeline
  endTime: number;
  trimStart: number;  // Trim within clip
  trimEnd: number;
  filters: VideoFilter[];
  transitions?: Transition;
}

export interface VideoFilter {
  type: 'grayscale' | 'sepia' | 'blur' | 'sharpen' | 'brightness' | 'contrast' | 'saturate' | 'speed';
  intensity: number;
}

export interface Transition {
  type: 'fade' | 'dissolve' | 'wipe' | 'slide';
  duration: number;
}

export interface OutputSettings {
  format: 'mp4' | 'webm' | 'gif';
  resolution: { width: number; height: number };
  fps: number;
  quality: 'low' | 'medium' | 'high';
  codec?: string;
}

export type PipelineStatus = 'idle' | 'loading' | 'processing' | 'complete' | 'error';

export interface PipelineState {
  status: PipelineStatus;
  progress: number;
  currentStep: string;
  error?: string;
}

class VideoPipeline {
  private state: PipelineState = {
    status: 'idle',
    progress: 0,
    currentStep: '',
  };
  
  private stateListeners: Array<(state: PipelineState) => void> = [];

  // Subscribe to state changes
  onStateChange(callback: (state: PipelineState) => void): () => void {
    this.stateListeners.push(callback);
    return () => {
      this.stateListeners = this.stateListeners.filter(cb => cb !== callback);
    };
  }

  private updateState(partial: Partial<PipelineState>): void {
    this.state = { ...this.state, ...partial };
    this.stateListeners.forEach(cb => cb(this.state));
  }

  // Initialize FFmpeg
  async initialize(): Promise<boolean> {
    this.updateState({ status: 'loading', currentStep: 'Loading FFmpeg...' });
    
    const loaded = await ffmpegService.load((progress) => {
      this.updateState({ progress: progress.ratio * 100 });
    });

    if (loaded) {
      this.updateState({ status: 'idle', currentStep: '', progress: 0 });
    } else {
      this.updateState({ status: 'error', error: 'Failed to load FFmpeg' });
    }

    return loaded;
  }

  // Check if ready
  isReady(): boolean {
    return ffmpegService.isLoaded();
  }

  // Check browser support
  isSupported(): boolean {
    return ffmpegService.isSupported();
  }

  // Get video metadata
  async getVideoMetadata(file: File): Promise<{
    duration: number;
    width: number;
    height: number;
  }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        resolve({
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight,
        });
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        reject(new Error('Failed to load video metadata'));
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  // Generate thumbnail for video
  async generateThumbnail(file: File, time: number = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadeddata = () => {
        video.currentTime = time;
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          reject(new Error('Could not get canvas context'));
        }
        
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        reject(new Error('Failed to generate thumbnail'));
        URL.revokeObjectURL(video.src);
      };
      
      video.src = URL.createObjectURL(file);
    });
  }

  // Create clip from file
  async createClip(file: File, name?: string): Promise<VideoClip> {
    const metadata = await this.getVideoMetadata(file);
    const thumbnail = await this.generateThumbnail(file, Math.min(1, metadata.duration / 2));
    
    return {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || file.name,
      file,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      thumbnail,
    };
  }

  // ==========================================
  // PROCESSING OPERATIONS
  // ==========================================

  // Trim video
  async trim(
    input: File,
    startTime: number,
    endTime: number,
    format: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: 'Trimming video...', progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    const result = await ffmpegService.trimVideo(input, startTime, endTime, format);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Merge multiple videos
  async merge(
    files: File[],
    format: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: 'Merging videos...', progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    const result = await ffmpegService.concatVideos(files, format);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Convert video format
  async convert(
    input: File,
    outputFormat: 'mp4' | 'webm' | 'avi' | 'mov' | 'gif',
    options?: {
      codec?: string;
      bitrate?: string;
      fps?: number;
      resolution?: string;
    }
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: `Converting to ${outputFormat}...`, progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    const result = await ffmpegService.convertVideo(input, outputFormat, options);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Apply filter
  async applyFilter(
    input: File,
    filter: VideoFilter['type'],
    intensity: number = 1,
    format: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: `Applying ${filter} filter...`, progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    if (filter === 'speed') {
      // Speed change uses different approach
      return this.changeSpeed(input, intensity, format);
    }

    const result = await ffmpegService.applyFilter(input, filter as any, intensity, format);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Change video speed
  async changeSpeed(
    input: File,
    speed: number,
    format: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: `Changing speed to ${speed}x...`, progress: 0 });
    
    try {
      await ffmpegService.load();
      
      const inputName = 'input.tmp';
      const outputName = `output.${format}`;
      
      await ffmpegService.writeFile(inputName, new Uint8Array(await input.arrayBuffer()));

      // Video filter for speed (inverse - 0.5 means 2x speed)
      const videoSpeed = 1 / speed;
      const audioSpeed = speed;

      await ffmpegService.exec([
        '-i', inputName,
        '-filter:v', `setpts=${videoSpeed}*PTS`,
        '-filter:a', `atempo=${Math.min(2, Math.max(0.5, audioSpeed))}`,
        '-y', outputName
      ]);
      
      const data = await ffmpegService.readFile(outputName);
      const blob = new Blob([data], { type: `video/${format}` });
      
      await ffmpegService.deleteFile(inputName);
      await ffmpegService.deleteFile(outputName);
      
      this.updateState({ status: 'complete', currentStep: '', progress: 100 });
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      this.updateState({ status: 'error', error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Resize video
  async resize(
    input: File,
    width: number,
    height: number,
    format: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: `Resizing to ${width}x${height}...`, progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    const result = await ffmpegService.resizeVideo(input, width, height, format);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Compress video
  async compress(
    input: File,
    quality: 'low' | 'medium' | 'high' = 'medium',
    format: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: `Compressing video...`, progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    const result = await ffmpegService.compressVideo(input, quality, format);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Extract audio
  async extractAudio(
    input: File,
    format: 'mp3' | 'wav' | 'aac' | 'ogg' = 'mp3'
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: `Extracting audio...`, progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    const result = await ffmpegService.extractAudio(input, format);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Create GIF
  async createGif(
    input: File,
    options?: {
      fps?: number;
      width?: number;
      startTime?: number;
      duration?: number;
    }
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: `Creating GIF...`, progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    const result = await ffmpegService.videoToGif(input, options);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Extract frames
  async extractFrames(
    input: File,
    options?: {
      fps?: number;
      startTime?: number;
      duration?: number;
      format?: 'png' | 'jpg';
    }
  ): Promise<{ success: boolean; frames?: Blob[]; error?: string }> {
    this.updateState({ status: 'processing', currentStep: `Extracting frames...`, progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    const result = await ffmpegService.extractFrames(input, options);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Add watermark
  async addWatermark(
    video: File,
    watermark: File,
    position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright' | 'center' = 'bottomright',
    format: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    this.updateState({ status: 'processing', currentStep: `Adding watermark...`, progress: 0 });
    
    ffmpegService.onProgress((p) => {
      this.updateState({ progress: p.ratio * 100 });
    });

    const result = await ffmpegService.addWatermark(video, watermark, position, format);
    
    this.updateState({
      status: result.success ? 'complete' : 'error',
      currentStep: '',
      progress: 100,
      error: result.error,
    });

    return result;
  }

  // Reset state
  reset(): void {
    this.updateState({
      status: 'idle',
      progress: 0,
      currentStep: '',
      error: undefined,
    });
  }

  // Cleanup
  terminate(): void {
    ffmpegService.terminate();
    this.reset();
  }
}

// Singleton instance
export const videoPipeline = new VideoPipeline();
export default videoPipeline;
