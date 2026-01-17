/**
 * Prompt templates for AI code generation
 */

/**
 * Get the system prompt for the AI
 */
export function getSystemPrompt() {
  return `You are an expert full-stack developer AI that generates complete, production-ready code projects.

Your role:
1. Analyze user requests to understand what they want to build
2. Generate complete, working code with proper structure
3. Include all necessary configuration files
4. Add helpful comments and documentation
5. Follow best practices for the chosen technology stack

Guidelines:
- Always generate working, runnable code
- Include proper error handling
- Add responsive design for web projects
- Follow security best practices
- Include README with clear setup instructions
- Use modern, widely-supported syntax
- Keep code clean and maintainable

You MUST respond with valid JSON containing the project structure.`;
}

/**
 * Get tech stack specific prompt additions
 */
export function getTechStackPrompt(techStack, language) {
  const stacks = {
    'react': `
**Tech Stack: React**
- Use React 18 with functional components and hooks
- Use Vite for build tooling
- Include CSS modules or styled-components
- Add proper TypeScript support if requested`,

    'react-ts': `
**Tech Stack: React + TypeScript**
- Use React 18 with TypeScript
- Use Vite for build tooling
- Include proper type definitions
- Use strict TypeScript configuration`,

    'vue': `
**Tech Stack: Vue 3**
- Use Vue 3 Composition API
- Use Vite for build tooling
- Include Single File Components
- Add Pinia for state management if needed`,

    'angular': `
**Tech Stack: Angular**
- Use Angular 17+
- Include proper module structure
- Use Angular CLI conventions
- Add routing if multi-page`,

    'node-express': `
**Tech Stack: Node.js + Express**
- Use Express.js with ES modules
- Include proper middleware setup
- Add error handling middleware
- Use environment variables for config`,

    'python-flask': `
**Tech Stack: Python + Flask**
- Use Flask with modern patterns
- Include requirements.txt
- Add proper error handling
- Use Flask-CORS for API projects`,

    'python-django': `
**Tech Stack: Python + Django**
- Use Django 5.0+
- Include proper project structure
- Add Django REST Framework for APIs
- Include migrations`,

    'java-spring': `
**Tech Stack: Java + Spring Boot**
- Use Spring Boot 3.x
- Include Maven or Gradle build
- Add proper package structure
- Include application.properties`,

    'go-gin': `
**Tech Stack: Go + Gin**
- Use Go 1.21+
- Use Gin web framework
- Include go.mod
- Add proper error handling`,

    'rust-actix': `
**Tech Stack: Rust + Actix**
- Use Rust with Actix-web
- Include Cargo.toml
- Add proper error types
- Include async/await patterns`,

    'vanilla-js': `
**Tech Stack: Vanilla JavaScript**
- Use modern ES6+ JavaScript
- Include HTML5 and CSS3
- Add responsive design
- No build tools required`
  };

  let prompt = '';
  
  if (techStack && stacks[techStack]) {
    prompt = stacks[techStack];
  } else if (language) {
    const langMap = {
      'javascript': stacks['vanilla-js'],
      'typescript': stacks['react-ts'],
      'python': stacks['python-flask'],
      'java': stacks['java-spring'],
      'go': stacks['go-gin'],
      'rust': stacks['rust-actix']
    };
    prompt = langMap[language.toLowerCase()] || '';
  }

  return prompt || `
**Tech Stack: Auto-detect**
Choose the most appropriate technology stack based on the user's request.
Consider the project type, complexity, and any mentioned preferences.`;
}

/**
 * Get supported tech stacks
 */
export function getSupportedTechStacks() {
  return [
    { id: 'vanilla-js', name: 'HTML/CSS/JavaScript', category: 'frontend' },
    { id: 'react', name: 'React', category: 'frontend' },
    { id: 'react-ts', name: 'React + TypeScript', category: 'frontend' },
    { id: 'vue', name: 'Vue 3', category: 'frontend' },
    { id: 'angular', name: 'Angular', category: 'frontend' },
    { id: 'node-express', name: 'Node.js + Express', category: 'backend' },
    { id: 'python-flask', name: 'Python + Flask', category: 'backend' },
    { id: 'python-django', name: 'Python + Django', category: 'backend' },
    { id: 'java-spring', name: 'Java + Spring Boot', category: 'backend' },
    { id: 'go-gin', name: 'Go + Gin', category: 'backend' },
    { id: 'rust-actix', name: 'Rust + Actix', category: 'backend' }
  ];
}

/**
 * Get supported languages
 */
export function getSupportedLanguages() {
  return [
    'JavaScript',
    'TypeScript',
    'Python',
    'Java',
    'Go',
    'Rust',
    'Ruby',
    'PHP',
    'C#',
    'Swift',
    'Kotlin'
  ];
}
