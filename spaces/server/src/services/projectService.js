import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { generateProjectCode, modifyProjectCode } from './aiService.js';
import { createZipArchive } from '../utils/archiver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory project store (in production, use a database)
const projects = new Map();

const GENERATED_DIR = path.join(__dirname, '../../generated');

/**
 * Initialize the generated directory
 */
async function ensureGeneratedDir() {
  try {
    await fs.mkdir(GENERATED_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

/**
 * Generate a new project based on user request
 * @param {Object} params - Generation parameters
 * @returns {Promise<Object>} Generated project
 */
export async function generateProject({ prompt, techStack, language, outputFormat }) {
  await ensureGeneratedDir();

  const projectId = uuidv4();
  
  // Generate project code using AI
  const generatedProject = await generateProjectCode({
    prompt,
    techStack,
    language
  });

  const project = {
    id: projectId,
    ...generatedProject,
    prompt,
    techStack: generatedProject.techStack || techStack,
    language: language || 'auto',
    outputFormat,
    status: 'completed',
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString()
  };

  // Write files to disk
  const projectPath = path.join(GENERATED_DIR, projectId);
  await writeProjectFiles(projectPath, project.files);

  // Store project metadata
  projects.set(projectId, project);
  await saveProjectMetadata(projectId, project);

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    techStack: project.techStack,
    language: project.language,
    status: project.status,
    files: project.files.map(f => ({ path: f.path, type: f.type })),
    setupInstructions: project.setupInstructions,
    dependencies: project.dependencies,
    previewUrl: `/api/preview/${projectId}`,
    downloadUrl: `/api/projects/${projectId}/download`,
    createdAt: project.createdAt
  };
}

/**
 * Get project by ID
 * @param {string} projectId - Project ID
 * @returns {Promise<Object|null>} Project or null
 */
export async function getProject(projectId) {
  // Check memory cache first
  if (projects.has(projectId)) {
    return projects.get(projectId);
  }

  // Try to load from disk
  try {
    const metadataPath = path.join(GENERATED_DIR, projectId, 'metadata.json');
    const metadata = await fs.readFile(metadataPath, 'utf-8');
    const project = JSON.parse(metadata);
    projects.set(projectId, project);
    return project;
  } catch {
    return null;
  }
}

/**
 * List all projects
 * @returns {Promise<Array>} List of projects
 */
export async function listProjects() {
  await ensureGeneratedDir();

  try {
    const dirs = await fs.readdir(GENERATED_DIR);
    const projectList = [];

    for (const dir of dirs) {
      try {
        const metadataPath = path.join(GENERATED_DIR, dir, 'metadata.json');
        const metadata = await fs.readFile(metadataPath, 'utf-8');
        const project = JSON.parse(metadata);
        projectList.push({
          id: project.id,
          name: project.name,
          description: project.description,
          techStack: project.techStack,
          status: project.status,
          createdAt: project.createdAt
        });
      } catch {
        // Skip invalid directories
      }
    }

    return projectList.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  } catch {
    return [];
  }
}

/**
 * Modify an existing project
 * @param {string} projectId - Project ID
 * @param {string} modification - Modification request
 * @returns {Promise<Object|null>} Modified project or null
 */
export async function modifyProject(projectId, modification) {
  const existingProject = await getProject(projectId);
  
  if (!existingProject) {
    return null;
  }

  // Generate modified project using AI
  const modifiedProject = await modifyProjectCode(existingProject, modification);

  const updatedProject = {
    ...existingProject,
    ...modifiedProject,
    modifiedAt: new Date().toISOString(),
    modifications: [
      ...(existingProject.modifications || []),
      { request: modification, timestamp: new Date().toISOString() }
    ]
  };

  // Write updated files to disk
  const projectPath = path.join(GENERATED_DIR, projectId);
  await writeProjectFiles(projectPath, updatedProject.files);

  // Update metadata
  projects.set(projectId, updatedProject);
  await saveProjectMetadata(projectId, updatedProject);

  return {
    id: updatedProject.id,
    name: updatedProject.name,
    description: updatedProject.description,
    techStack: updatedProject.techStack,
    status: updatedProject.status,
    files: updatedProject.files.map(f => ({ path: f.path, type: f.type })),
    setupInstructions: updatedProject.setupInstructions,
    previewUrl: `/api/preview/${projectId}`,
    downloadUrl: `/api/projects/${projectId}/download`,
    modifiedAt: updatedProject.modifiedAt
  };
}

/**
 * Download project as ZIP
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} ZIP file path and filename
 */
export async function downloadProject(projectId) {
  const project = await getProject(projectId);
  
  if (!project) {
    return { zipPath: null, filename: null };
  }

  const projectPath = path.join(GENERATED_DIR, projectId);
  const zipFilename = `${project.name || projectId}.zip`;
  const zipPath = path.join(GENERATED_DIR, projectId, zipFilename);

  // Create ZIP archive
  await createZipArchive(projectPath, zipPath, project.files);

  return { zipPath, filename: zipFilename };
}

/**
 * Write project files to disk
 */
async function writeProjectFiles(projectPath, files) {
  // Ensure project directory exists
  await fs.mkdir(projectPath, { recursive: true });

  for (const file of files) {
    const filePath = path.join(projectPath, file.path);
    const fileDir = path.dirname(filePath);

    // Ensure parent directories exist
    await fs.mkdir(fileDir, { recursive: true });

    // Write file content
    await fs.writeFile(filePath, file.content, 'utf-8');
  }
}

/**
 * Save project metadata to disk
 */
async function saveProjectMetadata(projectId, project) {
  const metadataPath = path.join(GENERATED_DIR, projectId, 'metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(project, null, 2), 'utf-8');
}
