import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { theme } = useStore();

  // Initialize terminal display
  const initializeXterm = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return;

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

    return terminal;
  }, [theme]);

  // Connect to backend terminal
  const connectToBackend = useCallback(async () => {
    const terminal = xtermRef.current;
    if (!terminal || isConnecting) return;

    setIsConnecting(true);
    setError(null);
    terminal.writeln('\x1b[33m⏳ Connecting to server...\x1b[0m');

    try {
      // Connect to socket server
      await socketService.connect();
      terminal.writeln('\x1b[32m✓ Socket connected\x1b[0m');

      // Create terminal session
      const terminalId = await socketService.createTerminal({
        cols: terminal.cols,
        rows: terminal.rows,
      });
      
      terminalIdRef.current = terminalId;
      terminal.writeln(`\x1b[32m✓ Terminal session created\x1b[0m`);
      terminal.writeln('');
      
      setIsConnected(true);
      setIsConnecting(false);

      // Set up output handler
      socketService.onTerminalOutput((data) => {
        if (data.terminalId === terminalIdRef.current) {
          terminal.write(data.data);
        }
      });

      // Set up exit handler
      socketService.onTerminalExit((data) => {
        if (data.terminalId === terminalIdRef.current) {
          terminal.writeln(`\x1b[33m\r\n[Process exited with code ${data.exitCode}]\x1b[0m`);
          setIsConnected(false);
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
      setError(errorMsg);
      setIsConnecting(false);
      setIsConnected(false);
      
      // Set up fallback input handler for retry
      setupFallbackHandler(terminal);
    }
  }, [isConnecting]);

  // Fallback handler for when not connected
  const setupFallbackHandler = useCallback((terminal: XTerminal) => {
    let currentLine = '';
    
    const dataHandler = (data: string) => {
      // Remove this handler once connected
      if (isConnected && terminalIdRef.current) {
        return;
      }

      const code = data.charCodeAt(0);

      if (code === 13) { // Enter
        terminal.write('\r\n');
        const cmd = currentLine.trim().toLowerCase();
        
        if (cmd === 'connect' || cmd === 'retry') {
          currentLine = '';
          connectToBackend();
        } else if (cmd === 'help') {
          terminal.writeln('\x1b[1;33mAvailable commands:\x1b[0m');
          terminal.writeln('  \x1b[36mconnect\x1b[0m - Connect to server terminal');
          terminal.writeln('  \x1b[36mretry\x1b[0m   - Retry connection');
          terminal.writeln('  \x1b[36mhelp\x1b[0m    - Show this help');
          terminal.write('\x1b[1;32m❯\x1b[0m ');
          currentLine = '';
        } else if (cmd) {
          terminal.writeln(`\x1b[31mNot connected. Type "connect" to connect to server.\x1b[0m`);
          terminal.write('\x1b[1;32m❯\x1b[0m ');
          currentLine = '';
        } else {
          terminal.write('\x1b[1;32m❯\x1b[0m ');
        }
      } else if (code === 127) { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          terminal.write('\b \b');
        }
      } else if (code >= 32) { // Printable characters
        currentLine += data;
        terminal.write(data);
      }
    };

    terminal.onData(dataHandler);
    terminal.write('\x1b[1;32m❯\x1b[0m ');
  }, [isConnected, connectToBackend]);

  // Initialize on mount
  useEffect(() => {
    const terminal = initializeXterm();
    if (terminal) {
      // Auto-connect to backend
      setTimeout(() => connectToBackend(), 500);
    }

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        // Notify server of resize
        if (terminalIdRef.current && socketService.isConnected()) {
          socketService.resizeTerminal(
            terminalIdRef.current,
            xtermRef.current.cols,
            xtermRef.current.rows
          );
        }
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Create resize observer for container
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      
      // Kill terminal session
      if (terminalIdRef.current) {
        socketService.killTerminal(terminalIdRef.current);
      }
      
      // Dispose xterm
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [initializeXterm, connectToBackend]);

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
            isConnected 
              ? 'bg-green-500/20 text-green-400' 
              : isConnecting 
                ? 'bg-yellow-500/20 text-yellow-400' 
                : 'bg-red-500/20 text-red-400'
          }`}>
            {isConnected ? '● Connected' : isConnecting ? '○ Connecting...' : '○ Disconnected'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isConnected && !isConnecting && (
            <button
              onClick={connectToBackend}
              className="text-xs px-2 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            >
              Connect
            </button>
          )}
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
