import express from 'express';
import { generateProject, getProject, listProjects, modifyProject, downloadProject } from '../services/projectService.js';

const router = express.Router();

/**
 * POST /api/projects/generate
 * Generate a new project based on user request
 * 
 * Body: {
 *   prompt: string - User's description of the project
 *   techStack?: string - Optional tech stack preference (e.g., "react-node", "vue-python")
 *   language?: string - Preferred programming language
 *   outputFormat?: "zip" | "preview" - Output format preference
 * }
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { prompt, techStack, language, outputFormat = 'preview' } = req.body;
    
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (prompt.length > 5000) {
      return res.status(400).json({ error: 'Prompt must be less than 5000 characters' });
    }

    const project = await generateProject({
      prompt: prompt.trim(),
      techStack,
      language,
      outputFormat
    });

    res.status(201).json({
      success: true,
      project
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id
 * Get project details by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, project });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects
 * List all generated projects
 */
router.get('/', async (req, res, next) => {
  try {
    const projects = await listProjects();
    res.json({ success: true, projects });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects/:id/modify
 * Request modifications to an existing project
 * 
 * Body: {
 *   modification: string - Description of changes wanted
 * }
 */
router.post('/:id/modify', async (req, res, next) => {
  try {
    const { modification } = req.body;
    
    if (!modification || typeof modification !== 'string' || modification.trim().length === 0) {
      return res.status(400).json({ error: 'Modification description is required' });
    }

    const project = await modifyProject(req.params.id, modification.trim());
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true, project });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id/download
 * Download project as ZIP file
 */
router.get('/:id/download', async (req, res, next) => {
  try {
    const { zipPath, filename } = await downloadProject(req.params.id);
    
    if (!zipPath) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.download(zipPath, filename);
  } catch (error) {
    next(error);
  }
});

export default router;
