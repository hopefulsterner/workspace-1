// FFmpeg WASM Service - Browser-side video/audio processing
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface FFmpegProgress {
  ratio: number;
  time: number;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  fps: number;
}

export interface ProcessingResult {
  success: boolean;
  data?: Uint8Array;
  blob?: Blob;
  url?: string;
  error?: string;
  metadata?: VideoMetadata;
}

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private loaded = false;
  private loading = false;
  private progressCallback: ((progress: FFmpegProgress) => void) | null = null;

  // Check if FFmpeg is supported
  isSupported(): boolean {
    return typeof SharedArrayBuffer !== 'undefined';
  }

  // Initialize FFmpeg WASM
  async load(onProgress?: (progress: FFmpegProgress) => void): Promise<boolean> {
    if (this.loaded) return true;
    if (this.loading) {
      // Wait for existing load to complete
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.loaded;
    }

    this.loading = true;
    this.progressCallback = onProgress || null;

    try {
      this.ffmpeg = new FFmpeg();

      // Set up progress handler
      this.ffmpeg.on('progress', ({ progress, time }) => {
        if (this.progressCallback) {
          this.progressCallback({ ratio: progress, time });
        }
      });

      // Set up log handler for debugging
      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      // Load FFmpeg core from CDN
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.loaded = true;
      console.log('✅ FFmpeg WASM loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load FFmpeg:', error);
      this.loaded = false;
      return false;
    } finally {
      this.loading = false;
    }
  }

  // Check if loaded
  isLoaded(): boolean {
    return this.loaded;
  }

  // Set progress callback
  onProgress(callback: (progress: FFmpegProgress) => void): void {
    this.progressCallback = callback;
  }

  // Write file to FFmpeg virtual filesystem
  async writeFile(name: string, data: Uint8Array | File | Blob | string): Promise<void> {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded');
    }

    let fileData: Uint8Array;
    
    if (typeof data === 'string') {
      // URL - fetch it
      fileData = await fetchFile(data);
    } else if (data instanceof File || data instanceof Blob) {
      fileData = new Uint8Array(await data.arrayBuffer());
    } else {
      fileData = data;
    }

    await this.ffmpeg.writeFile(name, fileData);
  }

  // Read file from FFmpeg virtual filesystem
  async readFile(name: string): Promise<Uint8Array> {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded');
    }
    return await this.ffmpeg.readFile(name) as Uint8Array;
  }

  // Delete file from virtual filesystem
  async deleteFile(name: string): Promise<void> {
    if (!this.ffmpeg || !this.loaded) return;
    try {
      await this.ffmpeg.deleteFile(name);
    } catch {
      // File might not exist, ignore
    }
  }

  // Execute FFmpeg command
  async exec(args: string[]): Promise<void> {
    if (!this.ffmpeg || !this.loaded) {
      throw new Error('FFmpeg not loaded');
    }
    await this.ffmpeg.exec(args);
  }

  // ==========================================
  // VIDEO PROCESSING OPERATIONS
  // ==========================================

  // Convert video format
  async convertVideo(
    input: File | Blob | Uint8Array,
    outputFormat: 'mp4' | 'webm' | 'avi' | 'mov' | 'gif',
    options?: {
      codec?: string;
      bitrate?: string;
      fps?: number;
      resolution?: string;
    }
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const inputName = 'input.tmp';
      const outputName = `output.${outputFormat}`;
      
      await this.writeFile(inputName, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));

      const args = ['-i', inputName];
      
      if (options?.codec) {
        args.push('-c:v', options.codec);
      } else if (outputFormat === 'webm') {
        args.push('-c:v', 'libvpx-vp9');
      } else if (outputFormat === 'mp4') {
        args.push('-c:v', 'libx264');
      }
      
      if (options?.bitrate) {
        args.push('-b:v', options.bitrate);
      }
      
      if (options?.fps) {
        args.push('-r', options.fps.toString());
      }
      
      if (options?.resolution) {
        args.push('-s', options.resolution);
      }

      args.push('-y', outputName);
      
      await this.exec(args);
      
      const data = await this.readFile(outputName);
      const blob = new Blob([data], { type: `video/${outputFormat}` });
      
      // Cleanup
      await this.deleteFile(inputName);
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Trim video
  async trimVideo(
    input: File | Blob | Uint8Array,
    startTime: number,
    endTime: number,
    outputFormat: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const inputName = 'input.tmp';
      const outputName = `output.${outputFormat}`;
      
      await this.writeFile(inputName, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));

      const duration = endTime - startTime;
      
      await this.exec([
        '-i', inputName,
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-c', 'copy',
        '-y', outputName
      ]);
      
      const data = await this.readFile(outputName);
      const blob = new Blob([data], { type: `video/${outputFormat}` });
      
      await this.deleteFile(inputName);
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Extract audio from video
  async extractAudio(
    input: File | Blob | Uint8Array,
    outputFormat: 'mp3' | 'wav' | 'aac' | 'ogg' = 'mp3'
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const inputName = 'input.tmp';
      const outputName = `output.${outputFormat}`;
      
      await this.writeFile(inputName, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));

      const codecMap: Record<string, string> = {
        mp3: 'libmp3lame',
        wav: 'pcm_s16le',
        aac: 'aac',
        ogg: 'libvorbis',
      };

      await this.exec([
        '-i', inputName,
        '-vn',
        '-acodec', codecMap[outputFormat],
        '-y', outputName
      ]);
      
      const data = await this.readFile(outputName);
      const mimeType = outputFormat === 'mp3' ? 'audio/mpeg' : `audio/${outputFormat}`;
      const blob = new Blob([data], { type: mimeType });
      
      await this.deleteFile(inputName);
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Create GIF from video
  async videoToGif(
    input: File | Blob | Uint8Array,
    options?: {
      fps?: number;
      width?: number;
      startTime?: number;
      duration?: number;
    }
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const inputName = 'input.tmp';
      const paletteName = 'palette.png';
      const outputName = 'output.gif';
      
      await this.writeFile(inputName, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));

      const fps = options?.fps || 10;
      const width = options?.width || 480;
      const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`;

      const inputArgs = ['-i', inputName];
      if (options?.startTime) {
        inputArgs.unshift('-ss', options.startTime.toString());
      }
      if (options?.duration) {
        inputArgs.push('-t', options.duration.toString());
      }

      // Generate palette
      await this.exec([
        ...inputArgs,
        '-vf', `${filters},palettegen`,
        '-y', paletteName
      ]);

      // Generate GIF with palette
      await this.exec([
        ...inputArgs,
        '-i', paletteName,
        '-lavfi', `${filters} [x]; [x][1:v] paletteuse`,
        '-y', outputName
      ]);
      
      const data = await this.readFile(outputName);
      const blob = new Blob([data], { type: 'image/gif' });
      
      await this.deleteFile(inputName);
      await this.deleteFile(paletteName);
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Resize video
  async resizeVideo(
    input: File | Blob | Uint8Array,
    width: number,
    height: number,
    outputFormat: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const inputName = 'input.tmp';
      const outputName = `output.${outputFormat}`;
      
      await this.writeFile(inputName, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));

      await this.exec([
        '-i', inputName,
        '-vf', `scale=${width}:${height}`,
        '-c:a', 'copy',
        '-y', outputName
      ]);
      
      const data = await this.readFile(outputName);
      const blob = new Blob([data], { type: `video/${outputFormat}` });
      
      await this.deleteFile(inputName);
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Add watermark to video
  async addWatermark(
    videoInput: File | Blob | Uint8Array,
    watermarkInput: File | Blob | Uint8Array,
    position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright' | 'center' = 'bottomright',
    outputFormat: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const videoName = 'input.tmp';
      const watermarkName = 'watermark.png';
      const outputName = `output.${outputFormat}`;
      
      await this.writeFile(videoName, videoInput instanceof Uint8Array ? videoInput : new Uint8Array(await videoInput.arrayBuffer()));
      await this.writeFile(watermarkName, watermarkInput instanceof Uint8Array ? watermarkInput : new Uint8Array(await watermarkInput.arrayBuffer()));

      const positions: Record<string, string> = {
        topleft: '10:10',
        topright: 'W-w-10:10',
        bottomleft: '10:H-h-10',
        bottomright: 'W-w-10:H-h-10',
        center: '(W-w)/2:(H-h)/2',
      };

      await this.exec([
        '-i', videoName,
        '-i', watermarkName,
        '-filter_complex', `overlay=${positions[position]}`,
        '-y', outputName
      ]);
      
      const data = await this.readFile(outputName);
      const blob = new Blob([data], { type: `video/${outputFormat}` });
      
      await this.deleteFile(videoName);
      await this.deleteFile(watermarkName);
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Concatenate videos
  async concatVideos(
    inputs: Array<File | Blob | Uint8Array>,
    outputFormat: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const inputNames: string[] = [];
      const outputName = `output.${outputFormat}`;
      
      // Write all input files
      for (let i = 0; i < inputs.length; i++) {
        const name = `input${i}.tmp`;
        inputNames.push(name);
        await this.writeFile(name, inputs[i] instanceof Uint8Array ? inputs[i] : new Uint8Array(await (inputs[i] as Blob).arrayBuffer()));
      }

      // Create concat file list
      const listContent = inputNames.map(n => `file '${n}'`).join('\n');
      await this.ffmpeg!.writeFile('list.txt', new TextEncoder().encode(listContent));

      await this.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'list.txt',
        '-c', 'copy',
        '-y', outputName
      ]);
      
      const data = await this.readFile(outputName);
      const blob = new Blob([data], { type: `video/${outputFormat}` });
      
      // Cleanup
      for (const name of inputNames) {
        await this.deleteFile(name);
      }
      await this.deleteFile('list.txt');
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Extract frames from video
  async extractFrames(
    input: File | Blob | Uint8Array,
    options?: {
      fps?: number;
      startTime?: number;
      duration?: number;
      format?: 'png' | 'jpg';
    }
  ): Promise<{ success: boolean; frames?: Blob[]; error?: string }> {
    try {
      await this.load();
      
      const inputName = 'input.tmp';
      const format = options?.format || 'jpg';
      
      await this.writeFile(inputName, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));

      const args = ['-i', inputName];
      
      if (options?.startTime) {
        args.push('-ss', options.startTime.toString());
      }
      if (options?.duration) {
        args.push('-t', options.duration.toString());
      }
      
      const fps = options?.fps || 1;
      args.push('-vf', `fps=${fps}`);
      args.push('-y', `frame%04d.${format}`);
      
      await this.exec(args);
      
      // Collect frames
      const frames: Blob[] = [];
      let frameNum = 1;
      
      while (true) {
        try {
          const frameName = `frame${frameNum.toString().padStart(4, '0')}.${format}`;
          const data = await this.readFile(frameName);
          const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
          frames.push(new Blob([data], { type: mimeType }));
          await this.deleteFile(frameName);
          frameNum++;
        } catch {
          break;
        }
      }
      
      await this.deleteFile(inputName);
      
      return { success: true, frames };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Apply video filter
  async applyFilter(
    input: File | Blob | Uint8Array,
    filter: 'grayscale' | 'sepia' | 'blur' | 'sharpen' | 'brightness' | 'contrast' | 'saturate',
    intensity: number = 1,
    outputFormat: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const inputName = 'input.tmp';
      const outputName = `output.${outputFormat}`;
      
      await this.writeFile(inputName, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));

      const filterMap: Record<string, string> = {
        grayscale: 'colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3',
        sepia: 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131',
        blur: `boxblur=${Math.round(intensity * 5)}:1`,
        sharpen: `unsharp=5:5:${intensity}:5:5:0`,
        brightness: `eq=brightness=${(intensity - 1) * 0.5}`,
        contrast: `eq=contrast=${intensity}`,
        saturate: `eq=saturation=${intensity}`,
      };

      await this.exec([
        '-i', inputName,
        '-vf', filterMap[filter],
        '-c:a', 'copy',
        '-y', outputName
      ]);
      
      const data = await this.readFile(outputName);
      const blob = new Blob([data], { type: `video/${outputFormat}` });
      
      await this.deleteFile(inputName);
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Generate thumbnail from video
  async generateThumbnail(
    input: File | Blob | Uint8Array,
    time: number = 0,
    size?: { width: number; height: number }
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const inputName = 'input.tmp';
      const outputName = 'thumbnail.jpg';
      
      await this.writeFile(inputName, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));

      const args = [
        '-i', inputName,
        '-ss', time.toString(),
        '-vframes', '1',
      ];
      
      if (size) {
        args.push('-s', `${size.width}x${size.height}`);
      }
      
      args.push('-y', outputName);
      
      await this.exec(args);
      
      const data = await this.readFile(outputName);
      const blob = new Blob([data], { type: 'image/jpeg' });
      
      await this.deleteFile(inputName);
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Compress video
  async compressVideo(
    input: File | Blob | Uint8Array,
    quality: 'low' | 'medium' | 'high' = 'medium',
    outputFormat: 'mp4' | 'webm' = 'mp4'
  ): Promise<ProcessingResult> {
    try {
      await this.load();
      
      const inputName = 'input.tmp';
      const outputName = `output.${outputFormat}`;
      
      await this.writeFile(inputName, input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer()));

      const crfMap = { low: 35, medium: 28, high: 23 };
      
      await this.exec([
        '-i', inputName,
        '-c:v', 'libx264',
        '-crf', crfMap[quality].toString(),
        '-preset', 'fast',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y', outputName
      ]);
      
      const data = await this.readFile(outputName);
      const blob = new Blob([data], { type: `video/${outputFormat}` });
      
      await this.deleteFile(inputName);
      await this.deleteFile(outputName);
      
      return {
        success: true,
        data,
        blob,
        url: URL.createObjectURL(blob),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Cleanup
  terminate(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.loaded = false;
    }
  }
}

// Singleton instance
export const ffmpegService = new FFmpegService();
export default ffmpegService;
