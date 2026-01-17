# 🚀 Spaces - AI Project Generator

**Spaces** is an AI-powered project generation platform where users describe what they want, and AI creates complete, working projects. No manual coding required - pure AI generation.

Similar to:
- ✅ GitHub Spark - Ask AI, get a complete working app
- ✅ v0 by Vercel - Describe UI, AI builds it
- ✅ Claude Projects - AI generates code from prompts

## ✨ Features

- **🎯 Simple Request Workflow**: Describe your project in plain English
- **🤖 AI-Powered Generation**: AI generates complete, working code
- **📦 Download as ZIP**: Get your entire project in one download
- **👁️ Live Preview**: See your generated project instantly
- **🔄 Easy Modifications**: Request changes, AI regenerates
- **🌐 Multi-Stack Support**: React, Vue, Node.js, Python, and more

## 🏗️ How It Works

```
User: "Create a portfolio website with dark mode and contact form"
    ↓
AI (GPT-4): 
  - Analyzes request
  - Generates HTML/CSS/JS
  - Creates backend if needed
  - Adds animations & dark mode
    ↓
System: 
  - Packages everything
  - Shows live preview
  - Creates downloadable ZIP
    ↓
User: Downloads/Previews/Modifies
```

## 🛠️ Tech Stack

### Server
- **Node.js** + **Express** - API server
- **OpenAI GPT-4** - AI code generation
- **Archiver** - ZIP file creation

### Client
- **React 18** - UI framework
- **Vite** - Build tool
- **CSS** - Styling (no external dependencies)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key (optional - works in demo mode without it)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/hopefulsterner/spaces.git
   cd spaces
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install
   cd ../client && npm install
   cd ..
   ```

3. **Configure environment (optional for demo mode)**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env and add your OpenAI API key
   ```

4. **Start the development servers**
   
   In one terminal:
   ```bash
   cd server
   npm run dev
   ```
   
   In another terminal:
   ```bash
   cd client
   npm run dev
   ```

5. **Open in browser**
   
   Visit [http://localhost:5173](http://localhost:5173)

## 📖 Usage

### Generate a Project

1. Enter a description of your project in the input box
2. Select a tech stack (or let AI choose automatically)
3. Click "Generate Project"
4. Wait for AI to create your project
5. Preview, explore files, or download

### Example Prompts

- "Create a todo app with local storage and dark mode"
- "Build a portfolio website with a contact form"
- "Create a REST API for a blog with CRUD operations"
- "Build a weather dashboard that shows current conditions"
- "Create a landing page for a SaaS product with pricing"

### Modify an Existing Project

1. Generate a project first
2. Click "Modify Current" button
3. Describe your changes (e.g., "Add user authentication")
4. Click "Apply Changes"
5. AI will update your project

## 🔌 API Reference

### Generate Project
```http
POST /api/projects/generate
Content-Type: application/json

{
  "prompt": "Create a todo app",
  "techStack": "react",
  "language": "javascript"
}
```

### Get Project
```http
GET /api/projects/:id
```

### List Projects
```http
GET /api/projects
```

### Modify Project
```http
POST /api/projects/:id/modify
Content-Type: application/json

{
  "modification": "Add dark mode support"
}
```

### Download Project
```http
GET /api/projects/:id/download
```

### Preview Project
```http
GET /api/preview/:id
```

## 🎨 Supported Tech Stacks

### Frontend
- **HTML/CSS/JavaScript** - Vanilla web projects
- **React** - React 18 with Vite
- **Vue** - Vue 3 with Vite
- **Angular** - Angular 17+

### Backend
- **Node.js + Express** - JavaScript API
- **Python + Flask** - Python API
- **Python + Django** - Full-featured Python framework
- **Java + Spring Boot** - Enterprise Java
- **Go + Gin** - Fast Go framework
- **Rust + Actix** - High-performance Rust

## 🔒 Security

- Input validation and sanitization
- Rate limiting on API endpoints
- Path traversal protection
- Helmet.js security headers
- CORS configuration

## 📝 License

MIT License - feel free to use this project for any purpose.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- The amazing open source community
- GitHub Spark, v0, and Claude for inspiration

---

**Built with ❤️ by the Spaces team**