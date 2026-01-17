import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { webContainerService } from '../services/webcontainer';
import { pyodideService } from '../services/pyodide';
import { useStore } from '../store/useStore';

interface TerminalProps {
  className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ className = '' }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isBooting, setIsBooting] = useState(false);
  const [webContainerReady, setWebContainerReady] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const currentLineRef = useRef('');
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  
  const { files, theme } = useStore();

  const writePrompt = useCallback((terminal: XTerminal) => {
    terminal.write('\x1b[1;32m❯\x1b[0m ');
  }, []);

  const clearCurrentLine = useCallback((terminal: XTerminal, length: number) => {
    for (let i = 0; i < length; i++) {
      terminal.write('\b \b');
    }
  }, []);

  // Initialize WebContainer
  const initWebContainer = useCallback(async (terminal: XTerminal) => {
    if (webContainerReady || isBooting) return;
    
    setIsBooting(true);
    terminal.writeln('\x1b[33m⏳ Initializing WebContainer...\x1b[0m');
    
    try {
      await webContainerService.boot();
      setWebContainerReady(true);
      terminal.writeln('\x1b[32m✅ WebContainer ready!\x1b[0m');
      
      // Mount current project files if any
      if (files.length > 0) {
        terminal.writeln('\x1b[90mMounting project files...\x1b[0m');
        await webContainerService.writeFiles(files);
        terminal.writeln('\x1b[32m✅ Files mounted!\x1b[0m');
      }
    } catch (error) {
      terminal.writeln(`\x1b[31m❌ WebContainer failed: ${error}\x1b[0m`);
      terminal.writeln('\x1b[90mSome features may be limited.\x1b[0m');
    } finally {
      setIsBooting(false);
    }
  }, [webContainerReady, isBooting, files]);

  // Initialize Pyodide
  const initPyodide = useCallback(async (terminal: XTerminal) => {
    if (pyodideReady || isBooting) return;
    
    setIsBooting(true);
    terminal.writeln('\x1b[33m⏳ Loading Python runtime (Pyodide)...\x1b[0m');
    
    try {
      await pyodideService.load();
      setPyodideReady(true);
      terminal.writeln('\x1b[32m✅ Python ready!\x1b[0m');
    } catch (error) {
      terminal.writeln(`\x1b[31m❌ Python failed to load: ${error}\x1b[0m`);
    } finally {
      setIsBooting(false);
    }
  }, [pyodideReady, isBooting]);

  // Handle command execution
  const handleCommand = useCallback(async (command: string, terminal: XTerminal) => {
    const [cmd, ...args] = command.split(' ');
    const cmdLower = cmd.toLowerCase();

    switch (cmdLower) {
      case 'help':
        terminal.writeln('\x1b[1;33m📖 Available Commands:\x1b[0m');
        terminal.writeln('');
        terminal.writeln('\x1b[1;36m  General:\x1b[0m');
        terminal.writeln('    \x1b[36mhelp\x1b[0m          - Show this help message');
        terminal.writeln('    \x1b[36mclear\x1b[0m         - Clear the terminal');
        terminal.writeln('    \x1b[36mecho\x1b[0m <text>   - Print text');
        terminal.writeln('    \x1b[36mdate\x1b[0m          - Show current date/time');
        terminal.writeln('    \x1b[36mpwd\x1b[0m           - Print working directory');
        terminal.writeln('');
        terminal.writeln('\x1b[1;36m  Node.js (WebContainer):\x1b[0m');
        terminal.writeln('    \x1b[36mnode\x1b[0m <file>   - Run JavaScript file');
        terminal.writeln('    \x1b[36mnpm\x1b[0m <cmd>     - Run npm commands');
        terminal.writeln('    \x1b[36mls\x1b[0m            - List files');
        terminal.writeln('    \x1b[36mcat\x1b[0m <file>    - Display file contents');
        terminal.writeln('');
        terminal.writeln('\x1b[1;36m  Python (Pyodide):\x1b[0m');
        terminal.writeln('    \x1b[36mpython\x1b[0m <code> - Run Python code inline');
        terminal.writeln('    \x1b[36mpython\x1b[0m -f <file> - Run Python file');
        terminal.writeln('    \x1b[36mpip\x1b[0m install <pkg> - Install Python package');
        terminal.writeln('');
        terminal.writeln('\x1b[1;36m  Init:\x1b[0m');
        terminal.writeln('    \x1b[36minit-node\x1b[0m     - Initialize WebContainer');
        terminal.writeln('    \x1b[36minit-python\x1b[0m   - Initialize Python runtime');
        break;

      case 'clear':
        terminal.clear();
        return; // Don't write prompt after clear

      case 'echo':
        terminal.writeln(args.join(' '));
        break;

      case 'date':
        terminal.writeln(`\x1b[36m${new Date().toLocaleString()}\x1b[0m`);
        break;

      case 'pwd':
        terminal.writeln('\x1b[36m/project\x1b[0m');
        break;

      case 'init-node':
        await initWebContainer(terminal);
        break;

      case 'init-python':
        await initPyodide(terminal);
        break;

      case 'ls':
        if (!webContainerReady) {
          terminal.writeln('\x1b[33m⚠ WebContainer not initialized. Run "init-node" first.\x1b[0m');
          // Show virtual files from store
          if (files.length > 0) {
            terminal.writeln('\x1b[90mProject files:\x1b[0m');
            files.forEach(f => {
              const icon = f.type === 'folder' ? '\x1b[34m📁' : '\x1b[0m📄';
              terminal.writeln(`  ${icon} ${f.name}\x1b[0m`);
            });
          } else {
            terminal.writeln('\x1b[90mNo files in project. Select a template to get started.\x1b[0m');
          }
        } else {
          try {
            const { output } = await webContainerService.runCommand('ls', ['-la', ...args]);
            terminal.writeln(output || '\x1b[90m(empty)\x1b[0m');
          } catch (error) {
            terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
          }
        }
        break;

      case 'cat':
        if (args.length === 0) {
          terminal.writeln('\x1b[31mUsage: cat <filename>\x1b[0m');
        } else if (!webContainerReady) {
          terminal.writeln('\x1b[33m⚠ WebContainer not initialized. Run "init-node" first.\x1b[0m');
        } else {
          try {
            const { output } = await webContainerService.runCommand('cat', args);
            terminal.writeln(output);
          } catch (error) {
            terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
          }
        }
        break;

      case 'node':
        if (!webContainerReady) {
          terminal.writeln('\x1b[33m⚠ WebContainer not initialized. Run "init-node" first.\x1b[0m');
        } else if (args.length === 0) {
          terminal.writeln('\x1b[90mNode.js interactive mode coming soon...\x1b[0m');
        } else {
          terminal.writeln(`\x1b[90mRunning: node ${args.join(' ')}\x1b[0m`);
          try {
            const { output, exitCode } = await webContainerService.runCommand('node', args);
            if (output) terminal.writeln(output);
            if (exitCode !== 0) {
              terminal.writeln(`\x1b[33mExited with code ${exitCode}\x1b[0m`);
            }
          } catch (error) {
            terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
          }
        }
        break;

      case 'npm':
        if (!webContainerReady) {
          terminal.writeln('\x1b[33m⚠ WebContainer not initialized. Run "init-node" first.\x1b[0m');
        } else {
          terminal.writeln(`\x1b[90mRunning: npm ${args.join(' ')}\x1b[0m`);
          try {
            const { output, exitCode } = await webContainerService.runCommand('npm', args);
            if (output) terminal.writeln(output);
            if (exitCode !== 0) {
              terminal.writeln(`\x1b[33mExited with code ${exitCode}\x1b[0m`);
            }
          } catch (error) {
            terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
          }
        }
        break;

      case 'python':
      case 'python3':
        if (!pyodideReady) {
          terminal.writeln('\x1b[33m⚠ Python not initialized. Run "init-python" first.\x1b[0m');
        } else if (args.length === 0) {
          terminal.writeln('\x1b[90mPython interactive mode coming soon...\x1b[0m');
          terminal.writeln('\x1b[90mTry: python print("Hello, World!")\x1b[0m');
        } else if (args[0] === '-f' && args[1]) {
          // Run file
          const file = files.find(f => f.name === args[1] || f.path === args[1]);
          if (file && file.content) {
            terminal.writeln(`\x1b[90mRunning: ${args[1]}\x1b[0m`);
            try {
              const result = await pyodideService.run(file.content);
              if (result.output) terminal.writeln(result.output);
              if (result.error) terminal.writeln(`\x1b[31m${result.error}\x1b[0m`);
            } catch (error) {
              terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
            }
          } else {
            terminal.writeln(`\x1b[31mFile not found: ${args[1]}\x1b[0m`);
          }
        } else {
          // Run inline code
          const code = args.join(' ');
          terminal.writeln(`\x1b[90m>>> ${code}\x1b[0m`);
          try {
            const result = await pyodideService.run(code);
            if (result.output) terminal.writeln(result.output);
            if (result.error) terminal.writeln(`\x1b[31m${result.error}\x1b[0m`);
            if (result.result !== undefined && result.result !== null) {
              terminal.writeln(`\x1b[36m${result.result}\x1b[0m`);
            }
          } catch (error) {
            terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
          }
        }
        break;

      case 'pip':
        if (!pyodideReady) {
          terminal.writeln('\x1b[33m⚠ Python not initialized. Run "init-python" first.\x1b[0m');
        } else if (args[0] === 'install' && args[1]) {
          terminal.writeln(`\x1b[90mInstalling: ${args[1]}\x1b[0m`);
          try {
            await pyodideService.installPackage(args[1]);
            terminal.writeln(`\x1b[32m✅ Installed ${args[1]}\x1b[0m`);
          } catch (error) {
            terminal.writeln(`\x1b[31mError: ${error}\x1b[0m`);
          }
        } else {
          terminal.writeln('\x1b[31mUsage: pip install <package>\x1b[0m');
        }
        break;

      default:
        terminal.writeln(`\x1b[31mCommand not found: ${cmd}\x1b[0m`);
        terminal.writeln('\x1b[90mType "help" for available commands.\x1b[0m');
    }
    
    writePrompt(terminal);
  }, [webContainerReady, pyodideReady, files, initWebContainer, initPyodide, writePrompt]);

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new XTerminal({
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#a78bfa',
        cursorAccent: '#0f172a',
        selectionBackground: '#6366f180',
        black: '#1e293b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#f1f5f9',
        brightBlack: '#475569',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Welcome message
    terminal.writeln('\x1b[1;35m╔════════════════════════════════════════════════════════╗\x1b[0m');
    terminal.writeln('\x1b[1;35m║\x1b[0m   \x1b[1;36m🚀 AI Digital Friend Zone Terminal\x1b[0m                    \x1b[1;35m║\x1b[0m');
    terminal.writeln('\x1b[1;35m╚════════════════════════════════════════════════════════╝\x1b[0m');
    terminal.writeln('');
    terminal.writeln('\x1b[90mWelcome! This terminal supports Node.js and Python.\x1b[0m');
    terminal.writeln('\x1b[90mType \x1b[36mhelp\x1b[90m for available commands.\x1b[0m');
    terminal.writeln('');
    writePrompt(terminal);

    terminal.onKey(async ({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

      if (domEvent.keyCode === 13) { // Enter
        terminal.writeln('');
        const cmd = currentLineRef.current.trim();
        if (cmd) {
          commandHistoryRef.current.push(cmd);
          historyIndexRef.current = commandHistoryRef.current.length;
          await handleCommand(cmd, terminal);
        } else {
          writePrompt(terminal);
        }
        currentLineRef.current = '';
      } else if (domEvent.keyCode === 8) { // Backspace
        if (currentLineRef.current.length > 0) {
          currentLineRef.current = currentLineRef.current.slice(0, -1);
          terminal.write('\b \b');
        }
      } else if (domEvent.keyCode === 38) { // Arrow Up
        if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
          clearCurrentLine(terminal, currentLineRef.current.length);
          currentLineRef.current = commandHistoryRef.current[historyIndexRef.current];
          terminal.write(currentLineRef.current);
        }
      } else if (domEvent.keyCode === 40) { // Arrow Down
        if (historyIndexRef.current < commandHistoryRef.current.length - 1) {
          historyIndexRef.current++;
          clearCurrentLine(terminal, currentLineRef.current.length);
          currentLineRef.current = commandHistoryRef.current[historyIndexRef.current];
          terminal.write(currentLineRef.current);
        } else {
          historyIndexRef.current = commandHistoryRef.current.length;
          clearCurrentLine(terminal, currentLineRef.current.length);
          currentLineRef.current = '';
        }
      } else if (domEvent.keyCode === 67 && domEvent.ctrlKey) { // Ctrl+C
        terminal.writeln('^C');
        currentLineRef.current = '';
        writePrompt(terminal);
      } else if (printable) {
        currentLineRef.current += key;
        terminal.write(key);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [handleCommand, writePrompt, clearCurrentLine]);

  return (
    <div className={`h-full ${theme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'} ${className}`}>
      {/* Terminal Header */}
      <div className={`flex items-center justify-between px-4 py-2 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'} ml-2`}>Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="New Terminal">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`} title="Clear">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Terminal Content */}
      <div ref={terminalRef} className="h-[calc(100%-40px)] p-2" />
    </div>
  );
};
