import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  FileNode, 
  OpenFile, 
  Project, 
  ChatMessage, 
  AIConfig, 
  Extension,
  Theme,
  PanelLayout,
  EditorSettings 
} from '../types';

interface StoreState {
  // Project
  currentProject: Project | null;
  projects: Project[];
  
  // Files
  files: FileNode[];
  openFiles: OpenFile[];
  activeFileId: string | null;
  
  // UI
  theme: Theme;
  layout: PanelLayout;
  sidebarOpen: boolean;
  sidebarTab: 'files' | 'templates' | 'extensions';
  aiPanelOpen: boolean;
  terminalOpen: boolean;
  previewOpen: boolean;
  
  // Editor Settings
  editorSettings: EditorSettings;
  
  // AI
  aiConfig: AIConfig;
  chatHistory: ChatMessage[];
  isAiLoading: boolean;
  
  // Extensions
  extensions: Extension[];
  
  // Actions - Project
  setCurrentProject: (project: Project | null) => void;
  createProject: (name: string, template: string, files: FileNode[]) => void;
  
  // Actions - Files
  setFiles: (files: FileNode[]) => void;
  openFile: (file: OpenFile) => void;
  closeFile: (fileId: string) => void;
  setActiveFile: (fileId: string | null) => void;
  updateFileContent: (fileId: string, content: string) => void;
  createFile: (path: string, name: string, content?: string) => void;
  createFolder: (path: string, name: string) => void;
  deleteNode: (path: string) => void;
  renameNode: (path: string, newName: string) => void;
  
  // Actions - UI
  setTheme: (theme: Theme) => void;
  setLayout: (layout: PanelLayout) => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: 'files' | 'templates' | 'extensions') => void;
  toggleAiPanel: () => void;
  toggleTerminal: () => void;
  togglePreview: () => void;
  
  // Actions - Editor Settings
  setEditorSettings: (settings: Partial<EditorSettings>) => void;
  
  // Actions - AI
  setAiConfig: (config: Partial<AIConfig>) => void;
  addMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  setAiLoading: (loading: boolean) => void;
  
  // Actions - Extensions
  toggleExtension: (extensionId: string) => void;
  addExtension: (extension: Extension) => void;
  removeExtension: (extensionId: string) => void;
  resetExtensions: () => void;
  syncExtensions: () => void;
}

const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  lineNumbers: true,
  autoSave: true,
};

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxTokens: 4096,
};

const DEFAULT_EXTENSIONS: Extension[] = [
  // Language Support
  {
    id: 'javascript',
    name: 'JavaScript',
    description: 'JavaScript and TypeScript support with IntelliSense',
    icon: '🟨',
    version: '1.0.0',
    category: 'Language',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    description: 'TypeScript language support and type checking',
    icon: '🔷',
    version: '1.0.0',
    category: 'Language',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python language support with Pylance',
    icon: '🐍',
    version: '1.0.0',
    category: 'Language',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'html',
    name: 'HTML',
    description: 'HTML language support and snippets',
    icon: '🌐',
    version: '1.0.0',
    category: 'Language',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'css',
    name: 'CSS',
    description: 'CSS, SCSS, and Less language support',
    icon: '🎨',
    version: '1.0.0',
    category: 'Language',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'json',
    name: 'JSON',
    description: 'JSON language support with schema validation',
    icon: '📋',
    version: '1.0.0',
    category: 'Language',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'markdown',
    name: 'Markdown',
    description: 'Markdown preview and editing support',
    icon: '📝',
    version: '1.0.0',
    category: 'Language',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'go',
    name: 'Go',
    description: 'Go language support',
    icon: '🐹',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'rust',
    name: 'Rust',
    description: 'Rust language support with rust-analyzer',
    icon: '🦀',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'java',
    name: 'Java',
    description: 'Java language support',
    icon: '☕',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'cpp',
    name: 'C/C++',
    description: 'C and C++ language support',
    icon: '⚙️',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'php',
    name: 'PHP',
    description: 'PHP language support',
    icon: '🐘',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'ruby',
    name: 'Ruby',
    description: 'Ruby language support',
    icon: '💎',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'swift',
    name: 'Swift',
    description: 'Swift language support',
    icon: '🐦',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'sql',
    name: 'SQL',
    description: 'SQL language support and formatting',
    icon: '🗄️',
    version: '1.0.0',
    category: 'Language',
    enabled: true,
    isBuiltIn: true,
  },
  // Frameworks
  {
    id: 'react',
    name: 'React',
    description: 'React development tools and snippets',
    icon: '⚛️',
    version: '1.0.0',
    category: 'Framework',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'vue',
    name: 'Vue.js',
    description: 'Vue 3 language support with Volar',
    icon: '💚',
    version: '1.0.0',
    category: 'Framework',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'angular',
    name: 'Angular',
    description: 'Angular language support and snippets',
    icon: '🅰️',
    version: '1.0.0',
    category: 'Framework',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'svelte',
    name: 'Svelte',
    description: 'Svelte language support',
    icon: '🔥',
    version: '1.0.0',
    category: 'Framework',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Next.js snippets and support',
    icon: '▲',
    version: '1.0.0',
    category: 'Framework',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'nodejs',
    name: 'Node.js',
    description: 'Node.js debugging and tools',
    icon: '🟢',
    version: '1.0.0',
    category: 'Framework',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'express',
    name: 'Express',
    description: 'Express.js snippets and support',
    icon: '🚂',
    version: '1.0.0',
    category: 'Framework',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'django',
    name: 'Django',
    description: 'Django framework support',
    icon: '🎸',
    version: '1.0.0',
    category: 'Framework',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'flask',
    name: 'Flask',
    description: 'Flask framework support',
    icon: '🧪',
    version: '1.0.0',
    category: 'Framework',
    enabled: false,
    isBuiltIn: true,
  },
  // Formatters & Linters
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    description: 'Tailwind CSS IntelliSense and autocomplete',
    icon: '💨',
    version: '1.0.0',
    category: 'Formatters',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'prettier',
    name: 'Prettier',
    description: 'Code formatter for multiple languages',
    icon: '✨',
    version: '1.0.0',
    category: 'Formatters',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'eslint',
    name: 'ESLint',
    description: 'JavaScript and TypeScript linting',
    icon: '🔍',
    version: '1.0.0',
    category: 'Formatters',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'stylelint',
    name: 'Stylelint',
    description: 'CSS and SCSS linting',
    icon: '💅',
    version: '1.0.0',
    category: 'Formatters',
    enabled: false,
    isBuiltIn: true,
  },
  // AI Extensions
  {
    id: 'copilot',
    name: 'AI Copilot',
    description: 'AI-powered code completion and suggestions',
    icon: '🤖',
    version: '1.0.0',
    category: 'AI',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'codewhisperer',
    name: 'Code Whisperer',
    description: 'AI code generation assistant',
    icon: '🧠',
    version: '1.0.0',
    category: 'AI',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'tabnine',
    name: 'Tabnine',
    description: 'AI autocomplete for all languages',
    icon: '⚡',
    version: '1.0.0',
    category: 'AI',
    enabled: false,
    isBuiltIn: true,
  },
  // Themes
  {
    id: 'dracula',
    name: 'Dracula Theme',
    description: 'A dark theme for the editor',
    icon: '🧛',
    version: '1.0.0',
    category: 'Themes',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'onedark',
    name: 'One Dark Pro',
    description: 'Atom One Dark theme',
    icon: '🌙',
    version: '1.0.0',
    category: 'Themes',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'github-theme',
    name: 'GitHub Theme',
    description: 'GitHub\'s official VS Code theme',
    icon: '🐙',
    version: '1.0.0',
    category: 'Themes',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'material-theme',
    name: 'Material Theme',
    description: 'Material Design inspired theme',
    icon: '🎨',
    version: '1.0.0',
    category: 'Themes',
    enabled: false,
    isBuiltIn: true,
  },
  // Tools
  {
    id: 'git',
    name: 'Git',
    description: 'Git version control integration',
    icon: '📦',
    version: '1.0.0',
    category: 'Source Control',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'gitlens',
    name: 'GitLens',
    description: 'Supercharge Git capabilities',
    icon: '🔮',
    version: '1.0.0',
    category: 'Source Control',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'docker',
    name: 'Docker',
    description: 'Docker container management',
    icon: '🐳',
    version: '1.0.0',
    category: 'Tools',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'rest-client',
    name: 'REST Client',
    description: 'Send HTTP requests directly from the editor',
    icon: '📡',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'live-server',
    name: 'Live Server',
    description: 'Launch a local dev server with live reload',
    icon: '🔄',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'path-intellisense',
    name: 'Path Intellisense',
    description: 'Autocomplete file paths',
    icon: '📁',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'auto-rename-tag',
    name: 'Auto Rename Tag',
    description: 'Auto rename paired HTML/XML tags',
    icon: '🏷️',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'bracket-colorizer',
    name: 'Bracket Colorizer',
    description: 'Colorize matching brackets',
    icon: '🌈',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'error-lens',
    name: 'Error Lens',
    description: 'Highlight errors and warnings inline',
    icon: '🔴',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'todo-highlight',
    name: 'TODO Highlight',
    description: 'Highlight TODO, FIXME and other annotations',
    icon: '📌',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'indent-rainbow',
    name: 'Indent Rainbow',
    description: 'Colorize indentation levels',
    icon: '🌈',
    version: '1.0.0',
    category: 'Tools',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'code-spell-checker',
    name: 'Code Spell Checker',
    description: 'Spell checker for source code',
    icon: '📖',
    version: '1.0.0',
    category: 'Tools',
    enabled: false,
    isBuiltIn: true,
  },
  // Snippets
  {
    id: 'es7-snippets',
    name: 'ES7+ Snippets',
    description: 'JavaScript/React/Redux/GraphQL snippets',
    icon: '📋',
    version: '1.0.0',
    category: 'Snippets',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'html-snippets',
    name: 'HTML Snippets',
    description: 'HTML5 snippets and boilerplate',
    icon: '📄',
    version: '1.0.0',
    category: 'Snippets',
    enabled: true,
    isBuiltIn: true,
  },
  // Testing
  {
    id: 'jest',
    name: 'Jest',
    description: 'Jest testing framework support',
    icon: '🃏',
    version: '1.0.0',
    category: 'Testing',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'vitest',
    name: 'Vitest',
    description: 'Vitest testing framework support',
    icon: '⚡',
    version: '1.0.0',
    category: 'Testing',
    enabled: false,
    isBuiltIn: true,
  },
  // Database
  {
    id: 'mongodb',
    name: 'MongoDB',
    description: 'MongoDB database tools',
    icon: '🍃',
    version: '1.0.0',
    category: 'Database',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    description: 'PostgreSQL database tools',
    icon: '🐘',
    version: '1.0.0',
    category: 'Database',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'prisma',
    name: 'Prisma',
    description: 'Prisma ORM support',
    icon: '🔺',
    version: '1.0.0',
    category: 'Database',
    enabled: false,
    isBuiltIn: true,
  },
  // Additional Development Tools
  {
    id: 'npm-intellisense',
    name: 'NPM Intellisense',
    description: 'Autocomplete npm modules in import statements',
    icon: '📦',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'import-cost',
    name: 'Import Cost',
    description: 'Display package size inline when importing',
    icon: '📊',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'debugger',
    name: 'Debugger',
    description: 'Built-in debugging support',
    icon: '🐛',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'terminal',
    name: 'Integrated Terminal',
    description: 'Terminal integration for running commands',
    icon: '💻',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  // CI/CD & Deployment
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    description: 'GitHub Actions workflow support',
    icon: '⚙️',
    version: '1.0.0',
    category: 'Tools',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deploy to Vercel directly',
    icon: '▲',
    version: '1.0.0',
    category: 'Tools',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'netlify',
    name: 'Netlify',
    description: 'Deploy to Netlify integration',
    icon: '🔷',
    version: '1.0.0',
    category: 'Tools',
    enabled: false,
    isBuiltIn: true,
  },
  // Code Quality
  {
    id: 'sonarqube',
    name: 'SonarQube',
    description: 'Code quality and security analysis',
    icon: '🔍',
    version: '1.0.0',
    category: 'Tools',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'codacy',
    name: 'Codacy',
    description: 'Automated code review',
    icon: '✅',
    version: '1.0.0',
    category: 'Tools',
    enabled: false,
    isBuiltIn: true,
  },
  // Documentation
  {
    id: 'jsdoc',
    name: 'JSDoc',
    description: 'JSDoc comment support and generation',
    icon: '📚',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'better-comments',
    name: 'Better Comments',
    description: 'Colorful and categorized code comments',
    icon: '💬',
    version: '1.0.0',
    category: 'Tools',
    enabled: true,
    isBuiltIn: true,
  },
  // Additional Frameworks
  {
    id: 'remix',
    name: 'Remix',
    description: 'Remix framework support',
    icon: '💿',
    version: '1.0.0',
    category: 'Framework',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'astro',
    name: 'Astro',
    description: 'Astro static site builder support',
    icon: '🚀',
    version: '1.0.0',
    category: 'Framework',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'nuxt',
    name: 'Nuxt.js',
    description: 'Nuxt.js Vue framework support',
    icon: '💚',
    version: '1.0.0',
    category: 'Framework',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'solid',
    name: 'SolidJS',
    description: 'SolidJS reactive framework support',
    icon: '🟦',
    version: '1.0.0',
    category: 'Framework',
    enabled: false,
    isBuiltIn: true,
  },
  // Additional Testing
  {
    id: 'cypress',
    name: 'Cypress',
    description: 'End-to-end testing framework',
    icon: '🌲',
    version: '1.0.0',
    category: 'Testing',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description: 'Cross-browser end-to-end testing',
    icon: '🎭',
    version: '1.0.0',
    category: 'Testing',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'testing-library',
    name: 'Testing Library',
    description: 'Testing Library for component testing',
    icon: '🧪',
    version: '1.0.0',
    category: 'Testing',
    enabled: false,
    isBuiltIn: true,
  },
  // Additional Snippets
  {
    id: 'react-snippets',
    name: 'React Snippets',
    description: 'React and hooks code snippets',
    icon: '⚛️',
    version: '1.0.0',
    category: 'Snippets',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'vue-snippets',
    name: 'Vue Snippets',
    description: 'Vue 3 composition API snippets',
    icon: '💚',
    version: '1.0.0',
    category: 'Snippets',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'css-snippets',
    name: 'CSS Snippets',
    description: 'Common CSS patterns and layouts',
    icon: '🎨',
    version: '1.0.0',
    category: 'Snippets',
    enabled: true,
    isBuiltIn: true,
  },
  // More AI Tools
  {
    id: 'codeium',
    name: 'Codeium',
    description: 'Free AI code autocomplete',
    icon: '✨',
    version: '1.0.0',
    category: 'AI',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'cursor',
    name: 'Cursor AI',
    description: 'AI-first code editor features',
    icon: '🎯',
    version: '1.0.0',
    category: 'AI',
    enabled: false,
    isBuiltIn: true,
  },
  // Database Tools
  {
    id: 'redis',
    name: 'Redis',
    description: 'Redis database tools',
    icon: '🔴',
    version: '1.0.0',
    category: 'Database',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'mysql',
    name: 'MySQL',
    description: 'MySQL database tools',
    icon: '🐬',
    version: '1.0.0',
    category: 'Database',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Supabase backend integration',
    icon: '⚡',
    version: '1.0.0',
    category: 'Database',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'firebase',
    name: 'Firebase',
    description: 'Firebase backend integration',
    icon: '🔥',
    version: '1.0.0',
    category: 'Database',
    enabled: false,
    isBuiltIn: true,
  },
  // More Themes
  {
    id: 'nord-theme',
    name: 'Nord Theme',
    description: 'Arctic, north-bluish color palette',
    icon: '❄️',
    version: '1.0.0',
    category: 'Themes',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    description: 'Dark theme inspired by Tokyo night',
    icon: '🌃',
    version: '1.0.0',
    category: 'Themes',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'synthwave',
    name: 'Synthwave \'84',
    description: 'Retro 80s synthwave theme',
    icon: '🌅',
    version: '1.0.0',
    category: 'Themes',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'monokai-pro',
    name: 'Monokai Pro',
    description: 'Professional Monokai color scheme',
    icon: '🎨',
    version: '1.0.0',
    category: 'Themes',
    enabled: false,
    isBuiltIn: true,
  },
  // Additional Languages
  {
    id: 'yaml',
    name: 'YAML',
    description: 'YAML language support',
    icon: '📝',
    version: '1.0.0',
    category: 'Language',
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'graphql',
    name: 'GraphQL',
    description: 'GraphQL language support and queries',
    icon: '◼️',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    description: 'Kotlin language support',
    icon: '🟪',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'dart',
    name: 'Dart',
    description: 'Dart language support for Flutter',
    icon: '🎯',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
  {
    id: 'solidity',
    name: 'Solidity',
    description: 'Solidity smart contract support',
    icon: '💎',
    version: '1.0.0',
    category: 'Language',
    enabled: false,
    isBuiltIn: true,
  },
];

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Initial State
      currentProject: null,
      projects: [],
      files: [],
      openFiles: [],
      activeFileId: null,
      theme: 'dark',
      layout: 'default',
      sidebarOpen: true,
      sidebarTab: 'files',
      aiPanelOpen: true,
      terminalOpen: true,
      previewOpen: true,
      editorSettings: DEFAULT_EDITOR_SETTINGS,
      aiConfig: DEFAULT_AI_CONFIG,
      chatHistory: [],
      isAiLoading: false,
      extensions: DEFAULT_EXTENSIONS,

      // Project Actions
      setCurrentProject: (project) => set({ currentProject: project }),
      
      createProject: (name, template, files) => {
        const project: Project = {
          id: crypto.randomUUID(),
          name,
          description: '',
          template,
          files,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          projects: [...state.projects, project],
          currentProject: project,
          files,
          openFiles: [],
          activeFileId: null,
        }));
      },

      // File Actions
      setFiles: (files) => set({ files }),
      
      openFile: (file) => {
        const { openFiles } = get();
        const exists = openFiles.find((f) => f.id === file.id);
        if (!exists) {
          set({ openFiles: [...openFiles, file], activeFileId: file.id });
        } else {
          set({ activeFileId: file.id });
        }
      },
      
      closeFile: (fileId) => {
        const { openFiles, activeFileId } = get();
        const newOpenFiles = openFiles.filter((f) => f.id !== fileId);
        let newActiveId = activeFileId;
        if (activeFileId === fileId) {
          newActiveId = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].id : null;
        }
        set({ openFiles: newOpenFiles, activeFileId: newActiveId });
      },
      
      setActiveFile: (fileId) => set({ activeFileId: fileId }),
      
      updateFileContent: (fileId, content) => {
        set((state) => ({
          openFiles: state.openFiles.map((f) =>
            f.id === fileId ? { ...f, content, isDirty: true } : f
          ),
        }));
      },

      createFile: (path, name, content = '') => {
        const id = crypto.randomUUID();
        const fullPath = path ? `${path}/${name}` : name;
        const language = getLanguageFromFilename(name);
        
        const newFile: FileNode = {
          id,
          name,
          type: 'file',
          path: fullPath,
          content,
          language,
        };
        
        set((state) => ({
          files: addNodeToTree(state.files, path, newFile),
        }));
      },

      createFolder: (path, name) => {
        const id = crypto.randomUUID();
        const fullPath = path ? `${path}/${name}` : name;
        
        const newFolder: FileNode = {
          id,
          name,
          type: 'folder',
          path: fullPath,
          children: [],
        };
        
        set((state) => ({
          files: addNodeToTree(state.files, path, newFolder),
        }));
      },

      deleteNode: (path) => {
        set((state) => ({
          files: removeNodeFromTree(state.files, path),
          openFiles: state.openFiles.filter((f) => !f.path.startsWith(path)),
        }));
      },

      renameNode: (path, newName) => {
        set((state) => ({
          files: renameNodeInTree(state.files, path, newName),
        }));
      },

      // UI Actions
      setTheme: (theme) => {
        set({ theme });
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
      
      setLayout: (layout) => set({ layout }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
      toggleTerminal: () => set((state) => ({ terminalOpen: !state.terminalOpen })),
      togglePreview: () => set((state) => ({ previewOpen: !state.previewOpen })),
      
      // Editor Settings Actions
      setEditorSettings: (settings) =>
        set((state) => ({ editorSettings: { ...state.editorSettings, ...settings } })),

      // AI Actions
      setAiConfig: (config) =>
        set((state) => ({ aiConfig: { ...state.aiConfig, ...config } })),
      
      addMessage: (message) =>
        set((state) => ({ chatHistory: [...state.chatHistory, message] })),
      
      clearChat: () => set({ chatHistory: [] }),
      
      setAiLoading: (loading) => set({ isAiLoading: loading }),

      // Extension Actions
      toggleExtension: (extensionId) =>
        set((state) => ({
          extensions: state.extensions.map((ext) =>
            ext.id === extensionId ? { ...ext, enabled: !ext.enabled } : ext
          ),
        })),
      
      addExtension: (extension) =>
        set((state) => {
          const exists = state.extensions.find((ext) => ext.id === extension.id);
          if (exists) return state;
          return { extensions: [...state.extensions, extension] };
        }),
      
      removeExtension: (extensionId) =>
        set((state) => ({
          extensions: state.extensions.filter((ext) => ext.id !== extensionId),
        })),

      resetExtensions: () =>
        set({ extensions: DEFAULT_EXTENSIONS }),

      syncExtensions: () =>
        set((state) => {
          // Merge new default extensions with existing state (preserving user's enabled/disabled choices)
          const existingIds = new Set(state.extensions.map(e => e.id));
          const newExtensions = DEFAULT_EXTENSIONS.filter(e => !existingIds.has(e.id));
          return { extensions: [...state.extensions, ...newExtensions] };
        }),
    }),
    {
      name: 'ai-friend-zone-storage',
      version: 2, // Increment version to trigger migration
      partialize: (state) => ({
        projects: state.projects,
        theme: state.theme,
        aiConfig: state.aiConfig,
        extensions: state.extensions,
        editorSettings: state.editorSettings,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<StoreState>;
        // If old version or extensions are too few, reset to defaults
        if (version < 2 || !state.extensions || state.extensions.length < 20) {
          return { ...state, extensions: DEFAULT_EXTENSIONS };
        }
        return state;
      },
    }
  )
);

// Helper functions
function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    kt: 'kotlin',
  };
  return langMap[ext || ''] || 'plaintext';
}

function addNodeToTree(nodes: FileNode[], parentPath: string, newNode: FileNode): FileNode[] {
  if (!parentPath) {
    return [...nodes, newNode];
  }
  
  return nodes.map((node) => {
    if (node.path === parentPath && node.type === 'folder') {
      return { ...node, children: [...(node.children || []), newNode] };
    }
    if (node.children) {
      return { ...node, children: addNodeToTree(node.children, parentPath, newNode) };
    }
    return node;
  });
}

function removeNodeFromTree(nodes: FileNode[], path: string): FileNode[] {
  return nodes
    .filter((node) => node.path !== path)
    .map((node) => {
      if (node.children) {
        return { ...node, children: removeNodeFromTree(node.children, path) };
      }
      return node;
    });
}

function renameNodeInTree(nodes: FileNode[], path: string, newName: string): FileNode[] {
  return nodes.map((node) => {
    if (node.path === path) {
      const pathParts = path.split('/');
      pathParts[pathParts.length - 1] = newName;
      return { ...node, name: newName, path: pathParts.join('/') };
    }
    if (node.children) {
      return { ...node, children: renameNodeInTree(node.children, path, newName) };
    }
    return node;
  });
}
