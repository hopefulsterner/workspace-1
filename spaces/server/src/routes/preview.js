import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { getProject } from '../services/projectService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * GET /api/preview/:id
 * Get preview HTML for a generated project
 */
router.get('/:id', async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Find the main HTML file to serve
    const projectPath = path.join(__dirname, '../../generated', project.id);
    
    // Look for index.html in common locations
    const htmlPaths = [
      path.join(projectPath, 'index.html'),
      path.join(projectPath, 'public', 'index.html'),
      path.join(projectPath, 'src', 'index.html'),
      path.join(projectPath, 'dist', 'index.html')
    ];

    let htmlContent = null;
    for (const htmlPath of htmlPaths) {
      try {
        htmlContent = await fs.readFile(htmlPath, 'utf-8');
        break;
      } catch {
        // Continue trying other paths
      }
    }

    if (htmlContent) {
      res.setHeader('Content-Type', 'text/html');
      res.send(htmlContent);
    } else {
      // Return a preview page showing project structure
      const previewHtml = generatePreviewPage(project);
      res.setHeader('Content-Type', 'text/html');
      res.send(previewHtml);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/preview/:id/files
 * Get list of files in the project
 */
router.get('/:id/files', async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ 
      success: true, 
      files: project.files || []
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/preview/:id/file/:filename
 * Get content of a specific file
 */
router.get('/:id/file/*', async (req, res, next) => {
  try {
    const project = await getProject(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const filename = req.params[0];
    const projectPath = path.join(__dirname, '../../generated', project.id);
    const filePath = path.join(projectPath, filename);

    // Security: Ensure the file is within the project directory
    const normalizedFilePath = path.normalize(filePath);
    if (!normalizedFilePath.startsWith(path.normalize(projectPath))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      res.json({ success: true, content, filename });
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Generate a preview page for projects without index.html
 */
function generatePreviewPage(project) {
  const fileList = (project.files || [])
    .map(f => `<li><code>${escapeHtml(f.path)}</code></li>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Preview - ${escapeHtml(project.name || project.id)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      min-height: 100vh;
      padding: 40px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #00d9ff; margin-bottom: 20px; }
    .description { 
      background: rgba(255,255,255,0.1); 
      padding: 20px; 
      border-radius: 8px; 
      margin-bottom: 20px;
    }
    .files { 
      background: rgba(0,0,0,0.3); 
      padding: 20px; 
      border-radius: 8px;
    }
    .files h2 { color: #00d9ff; margin-bottom: 15px; }
    .files ul { list-style: none; }
    .files li { 
      padding: 8px 12px; 
      margin: 4px 0; 
      background: rgba(255,255,255,0.05); 
      border-radius: 4px;
    }
    code { color: #00ff88; }
    .tech-stack {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    .badge {
      background: #00d9ff;
      color: #1a1a2e;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 ${escapeHtml(project.name || 'Generated Project')}</h1>
    <div class="description">
      <p>${escapeHtml(project.description || 'AI-generated project')}</p>
      <div class="tech-stack">
        ${project.techStack ? `<span class="badge">${escapeHtml(project.techStack)}</span>` : ''}
        ${project.language ? `<span class="badge">${escapeHtml(project.language)}</span>` : ''}
      </div>
    </div>
    <div class="files">
      <h2>📁 Project Files</h2>
      <ul>${fileList || '<li>No files generated yet</li>'}</ul>
    </div>
  </div>
</body>
</html>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

export default router;
