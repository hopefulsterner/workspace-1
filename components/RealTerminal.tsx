import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { socketService } from '../services/socket';
import { useStore } from '../store/useStore';

interface RealTerminalProps {
  className?: string;
}

export const RealTerminal: React.FC<RealTerminalProps> = ({ className = '' }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const isConnectingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  const { theme } = useStore();

  // Initialize terminal and connect - only once
  useEffect(() => {
    // Prevent double initialization
    if (hasInitializedRef.current) return;
    if (!terminalRef.current) return;
    
    hasInitializedRef.current = true;

    const isDark = theme === 'dark';
    
    const terminal = new XTerminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background: isDark ? '#0f172a' : '#ffffff',
        foreground: isDark ? '#e2e8f0' : '#1e293b',
        cursor: isDark ? '#60a5fa' : '#3b82f6',
        cursorAccent: isDark ? '#0f172a' : '#ffffff',
        selectionBackground: isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(59, 130, 246, 0.3)',
        black: isDark ? '#1e293b' : '#0f172a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: isDark ? '#f1f5f9' : '#334155',
        brightBlack: isDark ? '#475569' : '#64748b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: isDark ? '#ffffff' : '#0f172a',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Write welcome message
    terminal.writeln('\x1b[1;36m╔══════════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[1;36m║\x1b[0m   \x1b[1;33m⚡ AI Digital Friend Zone Terminal\x1b[0m    \x1b[1;36m║\x1b[0m');
    terminal.writeln('\x1b[1;36m║\x1b[0m      \x1b[90mReal-time Server Connection\x1b[0m        \x1b[1;36m║\x1b[0m');
    terminal.writeln('\x1b[1;36m╚══════════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');

    // Connect function
    const connectToBackend = async () => {
      if (isConnectingRef.current || terminalIdRef.current) return;
      
      isConnectingRef.current = true;
      setConnectionStatus('connecting');
      terminal.writeln('\x1b[33m⏳ Connecting to server...\x1b[0m');

      try {
        await socketService.connect();
        terminal.writeln('\x1b[32m✓ Socket connected\x1b[0m');

        const termId = await socketService.createTerminal({
          cols: terminal.cols,
          rows: terminal.rows,
        });
        
        terminalIdRef.current = termId;
        terminal.writeln('\x1b[32m✓ Terminal session created\x1b[0m');
        terminal.writeln('');
        
        setConnectionStatus('connected');
        isConnectingRef.current = false;

        // Set up output handler
        socketService.onTerminalOutput((data) => {
          if (data.terminalId === terminalIdRef.current && xtermRef.current) {
            xtermRef.current.write(data.data);
          }
        });

        // Set up exit handler
        socketService.onTerminalExit((data) => {
          if (data.terminalId === terminalIdRef.current) {
            terminal.writeln(`\x1b[33m\r\n[Process exited with code ${data.exitCode}]\x1b[0m`);
            setConnectionStatus('disconnected');
            terminalIdRef.current = null;
          }
        });

        // Handle user input
        terminal.onData((data) => {
          if (terminalIdRef.current && socketService.isConnected()) {
            socketService.sendTerminalInput(terminalIdRef.current, data);
          }
        });

      } catch (err: any) {
        const errorMsg = err.message || 'Failed to connect';
        terminal.writeln(`\x1b[31m✗ Connection failed: ${errorMsg}\x1b[0m`);
        terminal.writeln('\x1b[90mType "connect" to retry\x1b[0m');
        setConnectionStatus('disconnected');
        isConnectingRef.current = false;
        
        // Fallback input handler
        let currentLine = '';
        terminal.onData((data) => {
          if (terminalIdRef.current) return;
          
          const code = data.charCodeAt(0);
          if (code === 13) {
            terminal.write('\r\n');
            const cmd = currentLine.trim().toLowerCase();
            if (cmd === 'connect' || cmd === 'retry') {
              currentLine = '';
              connectToBackend();
            } else {
              terminal.writeln('\x1b[90mType "connect" to retry\x1b[0m');
              terminal.write('\x1b[1;32m❯\x1b[0m ');
              currentLine = '';
            }
          } else if (code === 127 && currentLine.length > 0) {
            currentLine = currentLine.slice(0, -1);
            terminal.write('\b \b');
          } else if (code >= 32) {
            currentLine += data;
            terminal.write(data);
          }
        });
        terminal.write('\x1b[1;32m❯\x1b[0m ');
      }
    };

    // Auto-connect after delay
    const connectTimer = setTimeout(connectToBackend, 500);

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (terminalIdRef.current && socketService.isConnected()) {
        socketService.resizeTerminal(terminalIdRef.current, terminal.cols, terminal.rows);
      }
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      clearTimeout(connectTimer);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      
      if (terminalIdRef.current) {
        socketService.killTerminal(terminalIdRef.current);
        terminalIdRef.current = null;
      }
      
      terminal.dispose();
      xtermRef.current = null;
      hasInitializedRef.current = false;
      isConnectingRef.current = false;
    };
  }, []); // Empty deps - only run once

  // Update theme
  useEffect(() => {
    if (xtermRef.current) {
      const isDark = theme === 'dark';
      xtermRef.current.options.theme = {
        background: isDark ? '#0f172a' : '#ffffff',
        foreground: isDark ? '#e2e8f0' : '#1e293b',
        cursor: isDark ? '#60a5fa' : '#3b82f6',
        cursorAccent: isDark ? '#0f172a' : '#ffffff',
        selectionBackground: isDark ? 'rgba(96, 165, 250, 0.3)' : 'rgba(59, 130, 246, 0.3)',
      };
    }
  }, [theme]);

  const bgColor = theme === 'dark' ? 'bg-slate-900' : 'bg-white';
  const borderColor = theme === 'dark' ? 'border-slate-700' : 'border-gray-200';
  const textColor = theme === 'dark' ? 'text-slate-300' : 'text-gray-600';

  return (
    <div className={`flex flex-col h-full ${bgColor} ${className}`}>
      {/* Terminal Header */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b ${borderColor}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Terminal</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-green-500/20 text-green-400' 
              : connectionStatus === 'connecting'
                ? 'bg-yellow-500/20 text-yellow-400' 
                : 'bg-red-500/20 text-red-400'
          }`}>
            {connectionStatus === 'connected' ? '● Connected' : connectionStatus === 'connecting' ? '○ Connecting...' : '○ Disconnected'}
          </span>
        </div>
      </div>

      {/* Terminal Container */}
      <div 
        ref={terminalRef}
        className="flex-1 min-h-0 p-2"
        style={{ overflow: 'hidden' }}
      />
    </div>
  );
};

export default RealTerminal;
