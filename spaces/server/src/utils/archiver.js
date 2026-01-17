import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

/**
 * Create a ZIP archive of project files
 * @param {string} projectPath - Path to the project directory
 * @param {string} zipPath - Path for the output ZIP file
 * @param {Array} files - Array of file objects with path and content
 * @returns {Promise<void>}
 */
export async function createZipArchive(projectPath, zipPath, files) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add each file to the archive
    for (const file of files) {
      if (file.path && file.content !== undefined) {
        // Skip metadata.json and any existing zip files
        if (file.path === 'metadata.json' || file.path.endsWith('.zip')) {
          continue;
        }
        archive.append(file.content, { name: file.path });
      }
    }

    archive.finalize();
  });
}

/**
 * Get MIME type for a file extension
 * @param {string} filename - Filename with extension
 * @returns {string} MIME type
 */
export function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.py': 'text/x-python',
    '.java': 'text/x-java',
    '.go': 'text/x-go',
    '.rs': 'text/x-rust',
    '.ts': 'application/typescript',
    '.tsx': 'application/typescript',
    '.jsx': 'application/javascript',
    '.vue': 'text/x-vue',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.xml': 'application/xml',
    '.sql': 'application/sql',
    '.sh': 'application/x-sh',
    '.zip': 'application/zip'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
