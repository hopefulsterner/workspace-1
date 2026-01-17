import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Get all files for a project
router.get('/project/:projectId', async (req, res) => {
  try {
    const files = await prisma.file.findMany({
      where: {
        projectId: req.params.projectId,
        project: { userId: req.userId },
      },
      orderBy: { path: 'asc' },
    });
    
    res.json({ files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get single file
router.get('/:id', async (req, res) => {
  try {
    const file = await prisma.file.findFirst({
      where: {
        id: req.params.id,
        project: { userId: req.userId },
      },
    });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ file });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// Create file
router.post('/', async (req, res) => {
  try {
    const { projectId, path, name, content, type = 'FILE' } = req.body;
    
    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const file = await prisma.file.create({
      data: {
        projectId,
        path,
        name,
        content: content || '',
        type,
        language: getLanguageFromFilename(name),
      },
    });
    
    res.status(201).json({ file });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create file' });
  }
});

// Update file content
router.patch('/:id', async (req, res) => {
  try {
    const { content } = req.body;
    
    const file = await prisma.file.updateMany({
      where: {
        id: req.params.id,
        project: { userId: req.userId },
      },
      data: {
        content,
        size: content?.length || 0,
      },
    });
    
    if (file.count === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.json({ message: 'File updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update file' });
  }
});

// Delete file
router.delete('/:id', async (req, res) => {
  try {
    await prisma.file.deleteMany({
      where: {
        id: req.params.id,
        project: { userId: req.userId },
      },
    });
    
    res.json({ message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Rename file
router.patch('/:id/rename', async (req, res) => {
  try {
    const { name, path } = req.body;
    
    await prisma.file.updateMany({
      where: {
        id: req.params.id,
        project: { userId: req.userId },
      },
      data: {
        name,
        path,
        language: getLanguageFromFilename(name),
      },
    });
    
    res.json({ message: 'File renamed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
  };
  return langMap[ext || ''] || 'plaintext';
}

export default router;
