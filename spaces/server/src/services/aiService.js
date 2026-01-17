import OpenAI from 'openai';
import { getTechStackPrompt, getSystemPrompt } from '../utils/prompts.js';

/**
 * AI Service - Handles communication with AI models for code generation
 * Supports OpenAI GPT-4 and can be extended for other providers
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'demo-key'
});

/**
 * Generate project code using AI
 * @param {Object} params - Generation parameters
 * @param {string} params.prompt - User's project description
 * @param {string} params.techStack - Selected tech stack
 * @param {string} params.language - Preferred programming language
 * @returns {Promise<Object>} Generated project structure and files
 */
export async function generateProjectCode({ prompt, techStack, language }) {
  const systemPrompt = getSystemPrompt();
  const techStackContext = getTechStackPrompt(techStack, language);

  const userPrompt = `
Generate a complete, working project based on this request:

**User Request:** ${prompt}

${techStackContext}

**Requirements:**
1. Generate ALL necessary files for a complete, runnable project
2. Include proper project structure (package.json, config files, etc.)
3. Add comments where helpful
4. Make the code production-ready with error handling
5. Include a README.md with setup instructions

**Response Format:**
Respond with a JSON object containing:
{
  "name": "project-name",
  "description": "Brief description of the project",
  "techStack": "Technology stack used",
  "files": [
    {
      "path": "relative/file/path.ext",
      "content": "file content here",
      "type": "file type (html, js, css, json, etc.)"
    }
  ],
  "setupInstructions": ["Step 1", "Step 2"],
  "dependencies": ["list of main dependencies"]
}

Generate the complete project now:`;

  try {
    // Check if we have a valid API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      // Return demo response for testing without API key
      return generateDemoProject(prompt, techStack, language);
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return validateAndSanitizeProject(parsed);
  } catch (error) {
    console.error('AI generation error:', error.message);
    // Fallback to demo mode on error
    return generateDemoProject(prompt, techStack, language);
  }
}

/**
 * Modify existing project code based on user request
 * @param {Object} existingProject - Current project data
 * @param {string} modification - User's modification request
 * @returns {Promise<Object>} Modified project structure
 */
export async function modifyProjectCode(existingProject, modification) {
  const systemPrompt = getSystemPrompt();
  
  const userPrompt = `
You have an existing project with these files:
${JSON.stringify(existingProject.files, null, 2)}

**Modification Request:** ${modification}

Modify the project to implement the requested changes. Return the complete updated project in the same JSON format:
{
  "name": "${existingProject.name}",
  "description": "Updated description",
  "techStack": "${existingProject.techStack}",
  "files": [updated file array with path, content, and type],
  "setupInstructions": ["Updated steps"],
  "dependencies": ["Updated dependencies"]
}

Only change files that need modification. Keep unchanged files as-is.`;

  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo-key') {
      // Demo modification
      return {
        ...existingProject,
        description: `${existingProject.description} (Modified: ${modification})`,
        modifiedAt: new Date().toISOString()
      };
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return validateAndSanitizeProject(parsed);
  } catch (error) {
    console.error('AI modification error:', error.message);
    return {
      ...existingProject,
      description: `${existingProject.description} (Modified: ${modification})`,
      modifiedAt: new Date().toISOString()
    };
  }
}

/**
 * Validate and sanitize project data from AI response
 */
function validateAndSanitizeProject(project) {
  if (!project.files || !Array.isArray(project.files)) {
    throw new Error('Invalid project structure: missing files array');
  }

  // Sanitize file paths to prevent directory traversal
  project.files = project.files.map(file => ({
    path: sanitizePath(file.path),
    content: file.content || '',
    type: file.type || getFileType(file.path)
  }));

  return {
    name: sanitizeName(project.name || 'generated-project'),
    description: project.description || 'AI-generated project',
    techStack: project.techStack || 'custom',
    files: project.files,
    setupInstructions: project.setupInstructions || [],
    dependencies: project.dependencies || []
  };
}

/**
 * Sanitize file paths to prevent directory traversal attacks
 */
function sanitizePath(filePath) {
  if (!filePath) return 'unknown.txt';
  // Remove any directory traversal attempts
  return filePath
    .replace(/\.\./g, '')
    .replace(/^\//, '')
    .replace(/^\\/, '')
    .trim();
}

/**
 * Sanitize project name
 */
function sanitizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/--+/g, '-')
    .substring(0, 50);
}

/**
 * Get file type from extension
 */
function getFileType(filePath) {
  const ext = filePath?.split('.').pop()?.toLowerCase();
  const typeMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'md': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'sql': 'sql'
  };
  return typeMap[ext] || 'text';
}

/**
 * Generate demo project for testing without API key
 */
function generateDemoProject(prompt, techStack, language) {
  const projectName = extractProjectName(prompt);
  const stack = techStack || detectTechStack(prompt, language);
  
  return getDemoTemplate(projectName, prompt, stack);
}

/**
 * Extract project name from prompt
 */
function extractProjectName(prompt) {
  const words = prompt.toLowerCase().split(' ');
  const keywords = ['create', 'build', 'make', 'generate', 'a', 'an', 'the', 'with', 'and', 'for'];
  const nameWords = words
    .filter(w => !keywords.includes(w) && w.length > 2)
    .slice(0, 3);
  return nameWords.join('-') || 'generated-project';
}

/**
 * Detect tech stack from prompt
 */
function detectTechStack(prompt, language) {
  const promptLower = prompt.toLowerCase();
  
  if (language) {
    const langMap = {
      'python': 'python-flask',
      'javascript': 'vanilla-js',
      'typescript': 'react-ts',
      'java': 'java-spring',
      'go': 'go-gin',
      'rust': 'rust-actix',
      'ruby': 'ruby-rails'
    };
    return langMap[language.toLowerCase()] || 'vanilla-js';
  }
  
  if (promptLower.includes('react')) return 'react';
  if (promptLower.includes('vue')) return 'vue';
  if (promptLower.includes('angular')) return 'angular';
  if (promptLower.includes('python') || promptLower.includes('flask')) return 'python-flask';
  if (promptLower.includes('node')) return 'node-express';
  if (promptLower.includes('api')) return 'node-express';
  
  return 'vanilla-js';
}

/**
 * Get demo template based on tech stack
 */
function getDemoTemplate(projectName, prompt, techStack) {
  const templates = {
    'vanilla-js': getVanillaJSTemplate,
    'react': getReactTemplate,
    'react-ts': getReactTemplate,
    'vue': getVueTemplate,
    'node-express': getNodeExpressTemplate,
    'python-flask': getPythonFlaskTemplate
  };

  const templateFn = templates[techStack] || getVanillaJSTemplate;
  return templateFn(projectName, prompt);
}

// Template generators
function getVanillaJSTemplate(name, prompt) {
  return {
    name,
    description: `AI-generated project: ${prompt}`,
    techStack: 'HTML/CSS/JavaScript',
    files: [
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>${name}</h1>
      <p>${prompt}</p>
    </header>
    <main>
      <section id="content">
        <!-- Main content goes here -->
        <p>Welcome to your AI-generated project!</p>
      </section>
    </main>
    <footer>
      <p>Generated by Spaces AI</p>
    </footer>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
        type: 'html'
      },
      {
        path: 'styles.css',
        content: `/* Generated styles for ${name} */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary-color: #3498db;
  --secondary-color: #2ecc71;
  --background: #1a1a2e;
  --surface: #16213e;
  --text: #e0e0e0;
  --text-muted: #a0a0a0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--background);
  color: var(--text);
  line-height: 1.6;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background: var(--surface);
  padding: 2rem;
  text-align: center;
  border-bottom: 2px solid var(--primary-color);
}

header h1 {
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

footer {
  background: var(--surface);
  padding: 1rem;
  text-align: center;
  color: var(--text-muted);
}

/* Dark mode toggle */
.dark-mode-toggle {
  position: fixed;
  top: 1rem;
  right: 1rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 5px;
  background: var(--primary-color);
  color: white;
  cursor: pointer;
}

/* Responsive design */
@media (max-width: 768px) {
  header {
    padding: 1rem;
  }
  
  main {
    padding: 1rem;
  }
}`,
        type: 'css'
      },
      {
        path: 'app.js',
        content: `// Generated JavaScript for ${name}
// ${prompt}

document.addEventListener('DOMContentLoaded', () => {
  console.log('${name} initialized');
  
  // Initialize the app
  init();
});

function init() {
  // Add your initialization logic here
  setupEventListeners();
  loadInitialData();
}

function setupEventListeners() {
  // Add event listeners
  document.addEventListener('click', handleClick);
}

function handleClick(event) {
  // Handle click events
  console.log('Clicked:', event.target);
}

async function loadInitialData() {
  // Load initial data if needed
  try {
    console.log('Loading initial data...');
    // Add your data loading logic here
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// Utility functions
function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}`,
        type: 'javascript'
      },
      {
        path: 'README.md',
        content: `# ${name}

${prompt}

## Getting Started

1. Open \`index.html\` in your browser
2. Or use a local server: \`npx serve .\`

## Features

- Modern, responsive design
- Dark theme
- Clean, maintainable code

## Generated by Spaces AI

This project was automatically generated based on your request.`,
        type: 'markdown'
      }
    ],
    setupInstructions: [
      'Open index.html in a browser',
      'Or run: npx serve .'
    ],
    dependencies: []
  };
}

function getReactTemplate(name, prompt) {
  return {
    name,
    description: `AI-generated React project: ${prompt}`,
    techStack: 'React',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name,
          version: '0.1.0',
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview'
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0'
          },
          devDependencies: {
            '@vitejs/plugin-react': '^4.2.1',
            vite: '^5.0.12'
          }
        }, null, 2),
        type: 'json'
      },
      {
        path: 'vite.config.js',
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
        type: 'javascript'
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
        type: 'html'
      },
      {
        path: 'src/main.jsx',
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        type: 'javascript'
      },
      {
        path: 'src/App.jsx',
        content: `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <header className="app-header">
        <h1>${name}</h1>
        <p>${prompt}</p>
      </header>
      
      <main className="app-main">
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            Count: {count}
          </button>
          <p>Edit src/App.jsx and save to test HMR</p>
        </div>
      </main>
      
      <footer className="app-footer">
        <p>Generated by Spaces AI</p>
      </footer>
    </div>
  )
}

export default App`,
        type: 'javascript'
      },
      {
        path: 'src/index.css',
        content: `:root {
  --primary: #646cff;
  --background: #242424;
  --text: rgba(255, 255, 255, 0.87);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Inter, system-ui, sans-serif;
  background: var(--background);
  color: var(--text);
  min-height: 100vh;
}`,
        type: 'css'
      },
      {
        path: 'src/App.css',
        content: `.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  padding: 2rem;
  text-align: center;
  background: #1a1a1a;
}

.app-header h1 {
  color: #646cff;
  margin-bottom: 0.5rem;
}

.app-main {
  flex: 1;
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.card {
  padding: 2rem;
  text-align: center;
}

.card button {
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  background: #1a1a1a;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.25s;
}

.card button:hover {
  border-color: #646cff;
}

.app-footer {
  padding: 1rem;
  text-align: center;
  background: #1a1a1a;
  color: #888;
}`,
        type: 'css'
      },
      {
        path: 'README.md',
        content: `# ${name}

${prompt}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- React 18 with Vite
- Modern tooling
- Hot Module Replacement

## Generated by Spaces AI`,
        type: 'markdown'
      }
    ],
    setupInstructions: [
      'npm install',
      'npm run dev'
    ],
    dependencies: ['react', 'react-dom', 'vite']
  };
}

function getVueTemplate(name, prompt) {
  return {
    name,
    description: `AI-generated Vue project: ${prompt}`,
    techStack: 'Vue 3',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name,
          version: '0.1.0',
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview'
          },
          dependencies: {
            vue: '^3.4.0'
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^5.0.0',
            vite: '^5.0.12'
          }
        }, null, 2),
        type: 'json'
      },
      {
        path: 'vite.config.js',
        content: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})`,
        type: 'javascript'
      },
      {
        path: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`,
        type: 'html'
      },
      {
        path: 'src/main.js',
        content: `import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')`,
        type: 'javascript'
      },
      {
        path: 'src/App.vue',
        content: `<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="app">
    <header>
      <h1>${name}</h1>
      <p>${prompt}</p>
    </header>
    
    <main>
      <div class="card">
        <button @click="count++">Count: {{ count }}</button>
      </div>
    </main>
    
    <footer>
      <p>Generated by Spaces AI</p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  padding: 2rem;
  text-align: center;
  background: #1a1a1a;
}

header h1 {
  color: #42b883;
}

main {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.card button {
  padding: 0.6em 1.2em;
  font-size: 1em;
  background: #1a1a1a;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}

.card button:hover {
  border-color: #42b883;
}

footer {
  padding: 1rem;
  text-align: center;
  background: #1a1a1a;
  color: #888;
}
</style>`,
        type: 'vue'
      },
      {
        path: 'src/style.css',
        content: `:root {
  --primary: #42b883;
  --background: #242424;
  --text: rgba(255, 255, 255, 0.87);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Inter, system-ui, sans-serif;
  background: var(--background);
  color: var(--text);
}`,
        type: 'css'
      },
      {
        path: 'README.md',
        content: `# ${name}

${prompt}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Generated by Spaces AI`,
        type: 'markdown'
      }
    ],
    setupInstructions: ['npm install', 'npm run dev'],
    dependencies: ['vue', 'vite']
  };
}

function getNodeExpressTemplate(name, prompt) {
  return {
    name,
    description: `AI-generated Node.js API: ${prompt}`,
    techStack: 'Node.js/Express',
    files: [
      {
        path: 'package.json',
        content: JSON.stringify({
          name,
          version: '1.0.0',
          type: 'module',
          main: 'src/index.js',
          scripts: {
            start: 'node src/index.js',
            dev: 'node --watch src/index.js'
          },
          dependencies: {
            express: '^4.18.2',
            cors: '^2.8.5',
            dotenv: '^16.3.1'
          }
        }, null, 2),
        type: 'json'
      },
      {
        path: 'src/index.js',
        content: `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    name: '${name}',
    description: '${prompt}',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});`,
        type: 'javascript'
      },
      {
        path: '.env.example',
        content: `PORT=3000`,
        type: 'text'
      },
      {
        path: 'README.md',
        content: `# ${name}

${prompt}

## Getting Started

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

## API Endpoints

- \`GET /\` - API info
- \`GET /api/health\` - Health check

## Generated by Spaces AI`,
        type: 'markdown'
      }
    ],
    setupInstructions: ['npm install', 'cp .env.example .env', 'npm run dev'],
    dependencies: ['express', 'cors', 'dotenv']
  };
}

function getPythonFlaskTemplate(name, prompt) {
  return {
    name,
    description: `AI-generated Python Flask API: ${prompt}`,
    techStack: 'Python/Flask',
    files: [
      {
        path: 'app.py',
        content: `from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return jsonify({
        'name': '${name}',
        'description': '${prompt}',
        'version': '1.0.0'
    })

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat()
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)`,
        type: 'python'
      },
      {
        path: 'requirements.txt',
        content: `flask>=3.0.0
flask-cors>=4.0.0`,
        type: 'text'
      },
      {
        path: 'README.md',
        content: `# ${name}

${prompt}

## Getting Started

\`\`\`bash
python -m venv venv
source venv/bin/activate  # or venv\\Scripts\\activate on Windows
pip install -r requirements.txt
python app.py
\`\`\`

## Generated by Spaces AI`,
        type: 'markdown'
      }
    ],
    setupInstructions: [
      'python -m venv venv',
      'source venv/bin/activate',
      'pip install -r requirements.txt',
      'python app.py'
    ],
    dependencies: ['flask', 'flask-cors']
  };
}
