import { ProjectTemplate } from '../types';

export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'react-vite',
    name: 'React + Vite',
    description: 'Modern React app with Vite, TypeScript, and Tailwind CSS',
    icon: '⚛️',
    category: 'frontend',
    dependencies: {
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.0.0',
      'vite': '^5.0.0',
      'typescript': '^5.0.0',
      'tailwindcss': '^3.4.0',
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
    },
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      'src/main.tsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
      'src/App.tsx': `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Hello, React! 👋
        </h1>
        <p className="text-gray-600 mb-6">
          Count: <span className="font-bold text-purple-600">{count}</span>
        </p>
        <button
          onClick={() => setCount(c => c + 1)}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
        >
          Increment
        </button>
      </div>
    </div>
  )
}

export default App`,
      'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
      'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}`,
      'package.json': '', // Will be generated
    },
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Full-stack React framework with App Router',
    icon: '▲',
    category: 'fullstack',
    dependencies: {
      'next': '^14.0.0',
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
    },
    devDependencies: {
      'typescript': '^5.0.0',
      '@types/react': '^18.2.0',
      'tailwindcss': '^3.4.0',
    },
    scripts: {
      'dev': 'next dev',
      'build': 'next build',
      'start': 'next start',
    },
    files: {
      'app/page.tsx': `export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4">
          Welcome to <span className="text-blue-500">Next.js</span>
        </h1>
        <p className="text-gray-400">
          Get started by editing <code className="bg-gray-800 px-2 py-1 rounded">app/page.tsx</code>
        </p>
      </div>
    </main>
  )
}`,
      'app/layout.tsx': `import './globals.css'

export const metadata = {
  title: 'Next.js App',
  description: 'Created with AI Digital Friend Zone',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
      'app/globals.css': `@tailwind base;
@tailwind components;
@tailwind utilities;`,
      'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}`,
      'next.config.js': `/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig`,
      'package.json': '',
    },
  },
  {
    id: 'vanilla-html',
    name: 'HTML/CSS/JS',
    description: 'Simple static website with vanilla JavaScript',
    icon: '🌐',
    category: 'static',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Website</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Hello, World! 🌍</h1>
    <p>Welcome to my website.</p>
    <button id="btn">Click Me</button>
    <p id="output"></p>
  </div>
  <script src="script.js"></script>
</body>
</html>`,
      'style.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  background: white;
  padding: 3rem;
  border-radius: 1rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  text-align: center;
}

h1 {
  color: #333;
  margin-bottom: 1rem;
}

p {
  color: #666;
  margin-bottom: 1.5rem;
}

button {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
}

#output {
  margin-top: 1rem;
  font-weight: bold;
  color: #667eea;
}`,
      'script.js': `let count = 0;

document.getElementById('btn').addEventListener('click', () => {
  count++;
  document.getElementById('output').textContent = \`Clicked \${count} time\${count === 1 ? '' : 's'}!\`;
});

console.log('Hello from JavaScript! 🚀');`,
    },
  },
  {
    id: 'python-fastapi',
    name: 'Python FastAPI',
    description: 'Modern Python API with FastAPI',
    icon: '🐍',
    category: 'api',
    files: {
      'main.py': `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI(title="My API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Item(BaseModel):
    id: int
    name: str
    description: str = ""

items: List[Item] = []

@app.get("/")
def read_root():
    return {"message": "Hello, World! 🐍", "docs": "/docs"}

@app.get("/items", response_model=List[Item])
def get_items():
    return items

@app.post("/items", response_model=Item)
def create_item(item: Item):
    items.append(item)
    return item

@app.get("/items/{item_id}")
def get_item(item_id: int):
    for item in items:
        if item.id == item_id:
            return item
    return {"error": "Item not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)`,
      'requirements.txt': `fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0`,
      'README.md': `# Python FastAPI

## Run locally
\`\`\`bash
pip install -r requirements.txt
python main.py
\`\`\`

Visit http://localhost:8000/docs for API documentation.`,
    },
  },
  {
    id: 'node-express',
    name: 'Node.js Express',
    description: 'Express.js REST API server',
    icon: '🟢',
    category: 'backend',
    dependencies: {
      'express': '^4.18.0',
      'cors': '^2.8.5',
    },
    devDependencies: {
      'nodemon': '^3.0.0',
    },
    scripts: {
      'start': 'node server.js',
      'dev': 'nodemon server.js',
    },
    files: {
      'server.js': `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let items = [];

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello, World! 🟢', endpoints: ['/api/items'] });
});

app.get('/api/items', (req, res) => {
  res.json(items);
});

app.post('/api/items', (req, res) => {
  const item = { id: Date.now(), ...req.body };
  items.push(item);
  res.status(201).json(item);
});

app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.delete('/api/items/:id', (req, res) => {
  items = items.filter(i => i.id !== parseInt(req.params.id));
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running on http://localhost:\${PORT}\`);
});`,
      'package.json': '',
    },
  },
  {
    id: 'vue-vite',
    name: 'Vue 3 + Vite',
    description: 'Vue 3 with Composition API and Vite',
    icon: '💚',
    category: 'frontend',
    dependencies: {
      'vue': '^3.4.0',
    },
    devDependencies: {
      '@vitejs/plugin-vue': '^5.0.0',
      'vite': '^5.0.0',
      'typescript': '^5.0.0',
    },
    scripts: {
      'dev': 'vite',
      'build': 'vite build',
      'preview': 'vite preview',
    },
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
      'src/main.ts': `import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')`,
      'src/App.vue': `<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="container">
    <h1>Hello, Vue! 💚</h1>
    <p>Count: {{ count }}</p>
    <button @click="count++">Increment</button>
  </div>
</template>

<style scoped>
.container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #42b883, #35495e);
  color: white;
}

button {
  background: white;
  color: #42b883;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 1rem;
}
</style>`,
      'src/style.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}`,
      'vite.config.ts': `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
})`,
      'package.json': '',
    },
  },
];

export const getTemplateById = (id: string): ProjectTemplate | undefined => {
  return TEMPLATES.find(t => t.id === id);
};

export const getTemplatesByCategory = (category: string): ProjectTemplate[] => {
  return TEMPLATES.filter(t => t.category === category);
};
