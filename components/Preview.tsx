
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { AppConfig, ChatMessage, Detection } from '../types';
import { generateAppResponse, detectObjects } from '../services/gemini';
import { Icons } from '../constants';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface PreviewProps {
  app: AppConfig;
  onUpdate: (updates: Partial<AppConfig>) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  isCameraActive: boolean;
  cameraResolution: '1080p' | '720p' | '480p';
  onSetResolution: (res: '1080p' | '720p' | '480p') => void;
  onCameraError: (error: any) => void;
  onToggleCamera: () => void;
  hasKey: boolean;
  onSelectKey: () => void;
  deviceView: 'desktop' | 'mobile';
}

export const Preview = forwardRef<any, PreviewProps>(({ 
  app, 
  onUpdate,
  isMaximized, 
  onToggleMaximize,
  isCameraActive,
  cameraResolution,
  onSetResolution,
  onCameraError,
  onToggleCamera,
  hasKey,
  onSelectKey,
  deviceView
}, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [uploadedImage, setUploadedImage] = useState<{ data: string; mimeType: string; preview: string } | null>(null);

  // Camera Capabilities State
  const [zoomCapability, setZoomCapability] = useState<{ min: number, max: number, step: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [focusCapability, setFocusCapability] = useState<{ min: number, max: number, step: number } | null>(null);
  const [currentFocus, setCurrentFocus] = useState<number>(0);
  const [focusMode, setFocusMode] = useState<string>('continuous');

  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useImperativeHandle(ref, () => ({
    startCamera: async (res: any) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: res === '1080p' ? 1920 : res === '720p' ? 1280 : 854 },
            facingMode: 'environment'
          },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;

          const track = stream.getVideoTracks()[0];
          const capabilities: any = (track as any).getCapabilities?.() || {};
          
          if (capabilities.zoom) {
            setZoomCapability(capabilities.zoom);
            setCurrentZoom((track.getSettings() as any).zoom || capabilities.zoom.min);
          } else {
            setZoomCapability(null);
          }

          if (capabilities.focusDistance) {
            setFocusCapability(capabilities.focusDistance);
            setCurrentFocus((track.getSettings() as any).focusDistance || capabilities.focusDistance.min);
          } else {
            setFocusCapability(null);
          }
        }
      } catch (err) {
        onCameraError(err);
      }
    },
    stopCamera: () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setZoomCapability(null);
      setFocusCapability(null);
    }
  }));

  const handleZoomChange = async (value: number) => {
    setCurrentZoom(value);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({ advanced: [{ zoom: value }] } as any);
      } catch (e) {
        console.warn('Failed to apply zoom:', e);
      }
    }
  };

  const handleFocusChange = async (value: number) => {
    setCurrentFocus(value);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({ 
          advanced: [{ focusMode: 'manual', focusDistance: value }] 
        } as any);
        setFocusMode('manual');
      } catch (e) {
        console.warn('Failed to apply focus:', e);
      }
    }
  };

  const resetFocus = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any);
        setFocusMode('continuous');
      } catch (e) {
        console.warn('Failed to reset focus:', e);
      }
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() && !uploadedImage && !isCameraActive) return;
    if (!hasKey) { onSelectKey(); return; }

    const userMsg: ChatMessage = { role: 'user', content: input || "[Context Input]", timestamp: Date.now() };
    const curImg = uploadedImage;
    const curInp = input;

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setUploadedImage(null);
    setIsLoading(true);

    try {
      let img = curImg ? { data: curImg.data, mimeType: curImg.mimeType } : undefined;
      if (isCameraActive && !img && videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        canvasRef.current.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        img = { data: canvasRef.current.toDataURL('image/jpeg', 0.85).split(',')[1], mimeType: 'image/jpeg' };
      }

      const response = await generateAppResponse(app, messages, curInp || userMsg.content, img);
      
      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          if (fc.name === 'update_workspace') {
            onUpdate(fc.args);
            setMessages(prev => [...prev, { 
              role: 'model', 
              content: `✨ _Workspace updated: ${Object.keys(fc.args).join(', ')}_`, 
              timestamp: Date.now() 
            }]);
          }
        }
      }

      if (response.text) {
        setMessages(prev => [...prev, { role: 'model', content: response.text || '', timestamp: Date.now() }]);
      }
    } catch (err: any) {
      if (err.message === 'AUTH_ERROR') onSelectKey();
      else setMessages(prev => [...prev, { role: 'model', content: 'Network Error: Check console for details.', timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScan = async () => {
    if (!isCameraActive || isScanning || !videoRef.current || !canvasRef.current) return;
    setIsScanning(true);
    try {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      canvasRef.current.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const res = await detectObjects({ data: canvasRef.current.toDataURL('image/jpeg', 0.85).split(',')[1], mimeType: 'image/jpeg' });
      setDetections(res);
    } catch (e: any) { if (e.message === 'AUTH_ERROR') onSelectKey(); }
    finally { setIsScanning(false); }
  };

  const isMobile = deviceView === 'mobile';

  return (
    <div className={`bg-slate-50 dark:bg-slate-900/50 flex flex-col h-screen shrink-0 relative overflow-hidden transition-all duration-500 ${isMaximized ? 'flex-1' : 'w-[480px] border-l border-slate-200 dark:border-slate-700'}`}>
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between sticky top-0 z-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-xl">{app.icon}</span>
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-tight">
            {isMobile ? 'Mobile Preview' : 'Active Preview'}
          </h2>
        </div>
        <button onClick={onToggleMaximize} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
          {isMaximized ? <Icons.LayoutSplit /> : <Icons.Maximize />}
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto transition-colors ${isMobile ? 'flex items-center justify-center p-8 bg-slate-200/50 dark:bg-slate-900/80' : 'p-4'}`}>
        <div className={`flex flex-col h-full transition-all duration-500 ${
          isMobile 
            ? 'w-[320px] h-[640px] bg-white dark:bg-slate-800 rounded-[3rem] border-[8px] border-slate-900 shadow-2xl relative overflow-hidden shrink-0' 
            : 'w-full h-full'
        }`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col" ref={scrollRef}>
            {messages.length === 0 && !isCameraActive && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                <span className="text-5xl mb-4">🤖</span>
                <p className="text-xs font-bold uppercase tracking-widest leading-tight dark:text-slate-200">System Online<br/>Ask me to build or modify anything.</p>
              </div>
            )}

            {isCameraActive && (
              <div className={`relative rounded-2xl overflow-hidden shadow-2xl border dark:border-slate-700 bg-black aspect-video group transition-all duration-500 shrink-0`}>
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
                
                {/* Camera Controls Overlay */}
                <div className="absolute inset-y-0 right-2 flex flex-col justify-center gap-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {zoomCapability && (
                    <div className="flex flex-col items-center gap-2 bg-black/50 backdrop-blur-md p-2 rounded-full pointer-events-auto">
                      <span className="text-[10px] text-white font-bold">ZOOM</span>
                      <input 
                        type="range"
                        min={zoomCapability.min}
                        max={zoomCapability.max}
                        step={zoomCapability.step}
                        value={currentZoom}
                        onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                        className="h-32 appearance-none bg-white/20 rounded-full overflow-hidden"
                        style={{ writingMode: 'bt-lr' as any, appearance: 'slider-vertical' as any }}
                      />
                      <span className="text-[10px] text-white font-mono">{currentZoom.toFixed(1)}x</span>
                    </div>
                  )}
                </div>

                <div className="absolute top-4 left-4 z-20 opacity-0 group-hover:opacity-100 transition-all">
                  <select 
                    value={cameraResolution}
                    onChange={(e) => onSetResolution(e.target.value as any)}
                    className="bg-black/60 backdrop-blur-md text-white border-none rounded-lg text-[10px] font-bold px-2 py-1 outline-none cursor-pointer hover:bg-black/80 transition-colors"
                  >
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                    <option value="480p">480p</option>
                  </select>
                </div>

                {isScanning && <div className="absolute inset-0 z-20 overflow-hidden"><div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-400 shadow-[0_0_25px_#818cf8] animate-scan" /></div>}
                
                <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2 z-30 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={handleScan} disabled={isScanning} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold shadow-xl">ANALYZE</button>
                  <button onClick={onToggleCamera} className="bg-white/10 backdrop-blur-md text-white px-3 py-2 rounded-lg text-[10px] font-bold">EXIT</button>
                </div>
              </div>
            )}

            <div className="space-y-4 flex-1">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-xs ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-700 border dark:border-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'}`}>
                    <div className="prose prose-sm prose-p:leading-relaxed max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && <div className="flex justify-start"><div className="bg-white dark:bg-slate-700 border dark:border-slate-600 p-3 rounded-2xl flex gap-1"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div></div></div>}
            </div>
          </div>

          <div className={`p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 ${isMobile ? 'pb-8' : ''} transition-colors`}>
            <div className="flex items-center gap-2">
              <input 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleSend()} 
                placeholder="Message your agent to self-modify..." 
                className="flex-1 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-indigo-500 outline-none dark:text-slate-200" 
              />
              <button onClick={handleSend} disabled={isLoading} className="bg-indigo-600 text-white w-10 h-10 rounded-xl shadow-lg flex items-center justify-center shrink-0 active:scale-95 transition-transform">
                <Icons.Play />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => {
        const f = e.target.files?.[0];
        if (f) {
          const r = new FileReader();
          r.onload = () => setUploadedImage({ data: (r.result as string).split(',')[1], mimeType: f.type, preview: r.result as string });
          r.readAsDataURL(f);
        }
      }} />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
});
