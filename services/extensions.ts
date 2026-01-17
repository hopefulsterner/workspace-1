// Extension System - VS Code-like plugin architecture
import type { Extension, ExtensionCommand, ExtensionAction } from '../types';

// Extension Registry
const registeredExtensions = new Map<string, Extension>();
const extensionCommands = new Map<string, { extension: string; handler: () => void | Promise<void> }>();
const extensionActions = new Map<string, ExtensionAction>();

// Event system for extensions
type EventHandler = (...args: any[]) => void;
const eventHandlers = new Map<string, Set<EventHandler>>();

export const extensionEvents = {
  on: (event: string, handler: EventHandler): void => {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set());
    }
    eventHandlers.get(event)!.add(handler);
  },

  off: (event: string, handler: EventHandler): void => {
    eventHandlers.get(event)?.delete(handler);
  },

  emit: (event: string, ...args: any[]): void => {
    eventHandlers.get(event)?.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Extension event handler error (${event}):`, error);
      }
    });
  },
};

// Extension API - exposed to extensions
export const extensionAPI = {
  // File operations
  files: {
    read: (path: string): string | null => {
      extensionEvents.emit('file:read', path);
      // This would connect to the store
      return null;
    },
    write: (path: string, content: string): void => {
      extensionEvents.emit('file:write', path, content);
    },
    delete: (path: string): void => {
      extensionEvents.emit('file:delete', path);
    },
    list: (path: string): string[] => {
      extensionEvents.emit('file:list', path);
      return [];
    },
  },

  // Editor operations
  editor: {
    getActiveFile: (): string | null => {
      extensionEvents.emit('editor:getActiveFile');
      return null;
    },
    openFile: (path: string): void => {
      extensionEvents.emit('editor:openFile', path);
    },
    getSelection: (): { start: number; end: number; text: string } | null => {
      extensionEvents.emit('editor:getSelection');
      return null;
    },
    insertText: (text: string): void => {
      extensionEvents.emit('editor:insertText', text);
    },
    replaceSelection: (text: string): void => {
      extensionEvents.emit('editor:replaceSelection', text);
    },
  },

  // Terminal operations
  terminal: {
    execute: (command: string): void => {
      extensionEvents.emit('terminal:execute', command);
    },
    write: (text: string): void => {
      extensionEvents.emit('terminal:write', text);
    },
    clear: (): void => {
      extensionEvents.emit('terminal:clear');
    },
  },

  // AI operations
  ai: {
    sendMessage: async (message: string): Promise<string> => {
      return new Promise((resolve) => {
        extensionEvents.emit('ai:sendMessage', message, resolve);
      });
    },
    getConversation: (): any[] => {
      extensionEvents.emit('ai:getConversation');
      return [];
    },
  },

  // UI operations
  ui: {
    showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error'): void => {
      extensionEvents.emit('ui:notification', message, type || 'info');
    },
    showModal: (content: string, title?: string): void => {
      extensionEvents.emit('ui:modal', content, title);
    },
    addStatusBarItem: (id: string, text: string, onClick?: () => void): void => {
      extensionEvents.emit('ui:statusBarAdd', id, text, onClick);
    },
    removeStatusBarItem: (id: string): void => {
      extensionEvents.emit('ui:statusBarRemove', id);
    },
  },

  // Storage for extension data
  storage: {
    get: (key: string): any => {
      const data = localStorage.getItem(`ext:${key}`);
      return data ? JSON.parse(data) : null;
    },
    set: (key: string, value: any): void => {
      localStorage.setItem(`ext:${key}`, JSON.stringify(value));
    },
    remove: (key: string): void => {
      localStorage.removeItem(`ext:${key}`);
    },
  },

  // Register command
  registerCommand: (id: string, handler: () => void | Promise<void>): void => {
    extensionEvents.emit('command:register', id, handler);
  },

  // Execute command
  executeCommand: async (id: string): Promise<void> => {
    const cmd = extensionCommands.get(id);
    if (cmd) {
      await cmd.handler();
    }
  },
};

// Extension Manager
export const extensionManager = {
  // Register an extension
  register: (extension: Extension): void => {
    if (registeredExtensions.has(extension.id)) {
      console.warn(`Extension ${extension.id} is already registered`);
      return;
    }

    registeredExtensions.set(extension.id, extension);

    // Register commands
    extension.commands?.forEach(cmd => {
      extensionCommands.set(cmd.id, {
        extension: extension.id,
        handler: cmd.handler,
      });
    });

    // Register actions
    extension.actions?.forEach(action => {
      extensionActions.set(`${extension.id}:${action.id}`, action);
    });

    console.log(`✨ Extension registered: ${extension.name}`);
    extensionEvents.emit('extension:registered', extension);
  },

  // Unregister an extension
  unregister: (extensionId: string): void => {
    const extension = registeredExtensions.get(extensionId);
    if (!extension) return;

    // Remove commands
    extension.commands?.forEach(cmd => {
      extensionCommands.delete(cmd.id);
    });

    // Remove actions
    extension.actions?.forEach(action => {
      extensionActions.delete(`${extensionId}:${action.id}`);
    });

    registeredExtensions.delete(extensionId);
    console.log(`Extension unregistered: ${extension.name}`);
    extensionEvents.emit('extension:unregistered', extension);
  },

  // Get extension by ID
  get: (extensionId: string): Extension | undefined => {
    return registeredExtensions.get(extensionId);
  },

  // Get all extensions
  getAll: (): Extension[] => {
    return Array.from(registeredExtensions.values());
  },

  // Enable extension
  enable: (extensionId: string): void => {
    const extension = registeredExtensions.get(extensionId);
    if (extension) {
      extension.enabled = true;
      extensionEvents.emit('extension:enabled', extension);
    }
  },

  // Disable extension
  disable: (extensionId: string): void => {
    const extension = registeredExtensions.get(extensionId);
    if (extension) {
      extension.enabled = false;
      extensionEvents.emit('extension:disabled', extension);
    }
  },

  // Execute command by ID
  executeCommand: async (commandId: string): Promise<void> => {
    const cmd = extensionCommands.get(commandId);
    if (cmd) {
      const extension = registeredExtensions.get(cmd.extension);
      if (extension?.enabled !== false) {
        await cmd.handler();
      }
    }
  },

  // Get all commands
  getCommands: (): ExtensionCommand[] => {
    const commands: ExtensionCommand[] = [];
    registeredExtensions.forEach(ext => {
      if (ext.enabled !== false && ext.commands) {
        commands.push(...ext.commands);
      }
    });
    return commands;
  },

  // Get actions for context
  getActions: (context: 'editor' | 'file' | 'terminal' | 'global'): ExtensionAction[] => {
    const actions: ExtensionAction[] = [];
    extensionActions.forEach(action => {
      if (action.context === context || action.context === 'global') {
        actions.push(action);
      }
    });
    return actions;
  },
};

// Built-in extensions
export const builtInExtensions: Extension[] = [
  {
    id: 'prettier',
    name: 'Prettier',
    description: 'Code formatter',
    version: '1.0.0',
    enabled: true,
    category: 'Formatters',
    icon: '✨',
    commands: [
      {
        id: 'prettier.format',
        name: 'Format Document',
        shortcut: 'Shift+Alt+F',
        handler: () => {
          extensionEvents.emit('format:document');
        },
      },
    ],
    actions: [
      {
        id: 'format',
        label: 'Format with Prettier',
        icon: '✨',
        context: 'editor',
        handler: () => extensionManager.executeCommand('prettier.format'),
      },
    ],
  },
  {
    id: 'emmet',
    name: 'Emmet',
    description: 'HTML/CSS abbreviation expander',
    version: '1.0.0',
    enabled: true,
    category: 'Snippets',
    icon: '⚡',
    commands: [
      {
        id: 'emmet.expand',
        name: 'Expand Abbreviation',
        shortcut: 'Tab',
        handler: () => {
          extensionEvents.emit('emmet:expand');
        },
      },
    ],
  },
  {
    id: 'git-tools',
    name: 'Git Tools',
    description: 'Git integration',
    version: '1.0.0',
    enabled: true,
    category: 'Source Control',
    icon: '📦',
    commands: [
      {
        id: 'git.init',
        name: 'Initialize Repository',
        handler: () => extensionAPI.terminal.execute('git init'),
      },
      {
        id: 'git.status',
        name: 'Show Status',
        handler: () => extensionAPI.terminal.execute('git status'),
      },
      {
        id: 'git.add',
        name: 'Stage All Changes',
        handler: () => extensionAPI.terminal.execute('git add .'),
      },
    ],
    actions: [
      {
        id: 'stage',
        label: 'Stage File',
        icon: '+',
        context: 'file',
        handler: (file?: string) => {
          if (file) extensionAPI.terminal.execute(`git add "${file}"`);
        },
      },
    ],
  },
  {
    id: 'snippets',
    name: 'Code Snippets',
    description: 'Common code snippets',
    version: '1.0.0',
    enabled: true,
    category: 'Snippets',
    icon: '📝',
    commands: [
      {
        id: 'snippets.react-component',
        name: 'Insert React Component',
        handler: () => {
          const snippet = `import React from 'react';

interface Props {
  // Add props here
}

export const Component: React.FC<Props> = (props) => {
  return (
    <div>
      {/* Component content */}
    </div>
  );
};`;
          extensionAPI.editor.insertText(snippet);
        },
      },
      {
        id: 'snippets.react-hook',
        name: 'Insert Custom Hook',
        handler: () => {
          const snippet = `import { useState, useEffect } from 'react';

export const useCustomHook = () => {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Effect logic
  }, []);

  return { state };
};`;
          extensionAPI.editor.insertText(snippet);
        },
      },
    ],
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    description: 'AI-powered code assistance',
    version: '1.0.0',
    enabled: true,
    category: 'AI',
    icon: '🤖',
    commands: [
      {
        id: 'ai.explain',
        name: 'Explain Selected Code',
        handler: async () => {
          const selection = extensionAPI.editor.getSelection();
          if (selection?.text) {
            await extensionAPI.ai.sendMessage(`Explain this code:\n\`\`\`\n${selection.text}\n\`\`\``);
          }
        },
      },
      {
        id: 'ai.refactor',
        name: 'Suggest Refactoring',
        handler: async () => {
          const selection = extensionAPI.editor.getSelection();
          if (selection?.text) {
            await extensionAPI.ai.sendMessage(`Suggest improvements for this code:\n\`\`\`\n${selection.text}\n\`\`\``);
          }
        },
      },
      {
        id: 'ai.generate-tests',
        name: 'Generate Tests',
        handler: async () => {
          const selection = extensionAPI.editor.getSelection();
          if (selection?.text) {
            await extensionAPI.ai.sendMessage(`Generate unit tests for this code:\n\`\`\`\n${selection.text}\n\`\`\``);
          }
        },
      },
    ],
    actions: [
      {
        id: 'explain',
        label: 'Explain Code',
        icon: '💡',
        context: 'editor',
        handler: () => extensionManager.executeCommand('ai.explain'),
      },
      {
        id: 'refactor',
        label: 'Suggest Refactor',
        icon: '🔧',
        context: 'editor',
        handler: () => extensionManager.executeCommand('ai.refactor'),
      },
    ],
  },
  {
    id: 'theme-switcher',
    name: 'Theme Switcher',
    description: 'Switch between themes',
    version: '1.0.0',
    enabled: true,
    category: 'Themes',
    icon: '🎨',
    commands: [
      {
        id: 'theme.dark',
        name: 'Dark Theme',
        handler: () => {
          document.documentElement.classList.add('dark');
          extensionAPI.storage.set('theme', 'dark');
        },
      },
      {
        id: 'theme.light',
        name: 'Light Theme',
        handler: () => {
          document.documentElement.classList.remove('dark');
          extensionAPI.storage.set('theme', 'light');
        },
      },
    ],
  },
  {
    id: 'file-icons',
    name: 'File Icons',
    description: 'File type icons',
    version: '1.0.0',
    enabled: true,
    category: 'Appearance',
    icon: '📁',
    settings: {
      iconPack: 'material',
    },
  },
];

// Initialize built-in extensions
export const initializeExtensions = (): void => {
  builtInExtensions.forEach(ext => {
    extensionManager.register(ext);
  });
  console.log(`✨ Initialized ${builtInExtensions.length} built-in extensions`);
};

// Create extension from config
export const createExtension = (config: {
  id: string;
  name: string;
  description: string;
  version?: string;
  category?: string;
  icon?: string;
  commands?: Array<{ id: string; name: string; shortcut?: string; code: string }>;
}): Extension => {
  const commands: ExtensionCommand[] = config.commands?.map(cmd => ({
    id: cmd.id,
    name: cmd.name,
    shortcut: cmd.shortcut,
    handler: () => {
      try {
        // Execute custom code in sandboxed context
        const fn = new Function('api', cmd.code);
        fn(extensionAPI);
      } catch (error) {
        console.error(`Extension command error (${cmd.id}):`, error);
      }
    },
  })) || [];

  return {
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version || '1.0.0',
    enabled: true,
    category: config.category || 'Custom',
    icon: config.icon || '🔌',
    commands,
  };
};
