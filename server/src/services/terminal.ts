import { Socket } from 'socket.io';
import * as pty from 'node-pty';
import os from 'os';

const terminals: Map<string, pty.IPty> = new Map();

export function setupTerminalSocket(socket: Socket) {
  // Create terminal
  socket.on('terminal:create', (data: { cols?: number; rows?: number }) => {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    
    const term = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: data.cols || 80,
      rows: data.rows || 24,
      cwd: process.env.HOME || process.cwd(),
      env: process.env as Record<string, string>,
    });
    
    const terminalId = `term_${socket.id}_${Date.now()}`;
    terminals.set(terminalId, term);
    
    // Send output to client
    term.onData((data) => {
      socket.emit('terminal:output', { terminalId, data });
    });
    
    // Handle terminal exit
    term.onExit(({ exitCode }) => {
      socket.emit('terminal:exit', { terminalId, exitCode });
      terminals.delete(terminalId);
    });
    
    socket.emit('terminal:created', { terminalId });
  });
  
  // Handle input from client
  socket.on('terminal:input', (data: { terminalId: string; input: string }) => {
    const term = terminals.get(data.terminalId);
    if (term) {
      term.write(data.input);
    }
  });
  
  // Resize terminal
  socket.on('terminal:resize', (data: { terminalId: string; cols: number; rows: number }) => {
    const term = terminals.get(data.terminalId);
    if (term) {
      term.resize(data.cols, data.rows);
    }
  });
  
  // Kill terminal
  socket.on('terminal:kill', (data: { terminalId: string }) => {
    const term = terminals.get(data.terminalId);
    if (term) {
      term.kill();
      terminals.delete(data.terminalId);
    }
  });
  
  // Cleanup on disconnect
  socket.on('disconnect', () => {
    terminals.forEach((term, id) => {
      if (id.includes(socket.id)) {
        term.kill();
        terminals.delete(id);
      }
    });
  });
}
