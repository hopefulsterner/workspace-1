const API_BASE = '/api';

/**
 * Generate a new project
 * @param {string} prompt - User's project description
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated project
 */
export async function generateProject(prompt, options = {}) {
  const response = await fetch(`${API_BASE}/projects/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      techStack: options.techStack,
      language: options.language,
      outputFormat: options.outputFormat || 'preview'
    })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate project');
  }

  return data.project;
}

/**
 * Get project by ID
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Project data
 */
export async function getProject(projectId) {
  const response = await fetch(`${API_BASE}/projects/${projectId}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to get project');
  }

  return data.project;
}

/**
 * List all projects
 * @returns {Promise<Array>} List of projects
 */
export async function listProjects() {
  const response = await fetch(`${API_BASE}/projects`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to list projects');
  }

  return data.projects;
}

/**
 * Modify an existing project
 * @param {string} projectId - Project ID
 * @param {string} modification - Modification description
 * @returns {Promise<Object>} Modified project
 */
export async function modifyProject(projectId, modification) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/modify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ modification })
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to modify project');
  }

  return data.project;
}

/**
 * Get project files
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} List of files
 */
export async function getProjectFiles(projectId) {
  const response = await fetch(`${API_BASE}/preview/${projectId}/files`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to get project files');
  }

  return data.files;
}

/**
 * Get file content
 * @param {string} projectId - Project ID
 * @param {string} filename - File path
 * @returns {Promise<string>} File content
 */
export async function getFileContent(projectId, filename) {
  const response = await fetch(`${API_BASE}/preview/${projectId}/file/${filename}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to get file content');
  }

  return data.content;
}
