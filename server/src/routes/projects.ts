import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all projects for user
router.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { files: true, deployments: true },
        },
      },
    });
    
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        files: {
          orderBy: { path: 'asc' },
        },
      },
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  template: z.string().optional(),
});

router.post('/', async (req, res) => {
  try {
    const { name, description, template } = createProjectSchema.parse(req.body);
    
    const project = await prisma.project.create({
      data: {
        name,
        description,
        template,
        userId: req.userId!,
      },
    });
    
    // Create default files based on template
    if (template) {
      await createTemplateFiles(project.id, template);
    }
    
    res.status(201).json({ project });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.patch('/:id', async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    
    const project = await prisma.project.updateMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(settings && { settings }),
      },
    });
    
    if (project.count === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ message: 'Project updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    await prisma.project.deleteMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });
    
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Helper function to create template files
async function createTemplateFiles(projectId: string, template: string) {
  const templates: Record<string, Array<{ path: string; name: string; content: string }>> = {
    react: [
      {
        path: '/src/App.tsx',
        name: 'App.tsx',
        content: `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <h1 className="text-4xl font-bold text-blue-600">Hello React!</h1>
    </div>
  );
}`,
      },
      {
        path: '/src/index.tsx',
        name: 'index.tsx',
        content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);`,
      },
      {
        path: '/src/index.css',
        name: 'index.css',
        content: `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      },
      {
        path: '/package.json',
        name: 'package.json',
        content: JSON.stringify({
          name: 'react-app',
          version: '1.0.0',
          scripts: {
            dev: 'vite',
            build: 'vite build',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            vite: '^5.0.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        }, null, 2),
      },
    ],
    // Add more templates...
  };
  
  const files = templates[template] || [];
  
  for (const file of files) {
    await prisma.file.create({
      data: {
        path: file.path,
        name: file.name,
        content: file.content,
        projectId,
        type: 'FILE',
      },
    });
  }
}

export default router;
