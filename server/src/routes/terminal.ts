import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Terminal sessions are handled via WebSocket
// This route is for REST API fallback and session management

router.post('/create', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    // Create a terminal session ID
    const sessionId = `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({ 
      sessionId,
      message: 'Connect via WebSocket for terminal access',
      wsEndpoint: `/terminal/${sessionId}`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create terminal session' });
  }
});

router.post('/execute', async (req, res) => {
  try {
    const { command, cwd } = req.body;
    
    // For simple command execution (non-interactive)
    const { exec } = require('child_process');
    
    exec(command, { cwd: cwd || process.cwd() }, (error: any, stdout: string, stderr: string) => {
      if (error) {
        return res.json({ output: stderr || error.message, exitCode: error.code });
      }
      res.json({ output: stdout, exitCode: 0 });
    });
  } catch (error) {
    res.status(500).json({ error: 'Command execution failed' });
  }
});

export default router;
