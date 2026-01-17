import { WebContainer } from '@webcontainer/api';
import { FileNode } from '../types';

let webcontainerInstance: WebContainer | null = null;
let isBooting = false;

export interface WebContainerService {
  boot: () => Promise<WebContainer>;
  getInstance: () => WebContainer | null;
  writeFiles: (files: FileNode[]) => Promise<void>;
  runCommand: (command: string, args?: string[]) => Promise<{
    output: string;
    exitCode: number;
  }>;
  startDevServer: (command: string, args?: string[]) => Promise<{
    url: string;
    process: any;
  }>;
  onServerReady: (callback: (port: number, url: string) => void) => void;
}

// Convert FileNode tree to WebContainer file system format
function convertToWebContainerFiles(nodes: FileNode[], basePath: string = ''): Record<string, any> {
  const result: Record<string, any> = {};

  for (const node of nodes) {
    const name = node.name;
    
    if (node.type === 'folder') {
      result[name] = {
        directory: node.children ? convertToWebContainerFiles(node.children, `${basePath}/${name}`) : {},
      };
    } else {
      result[name] = {
        file: {
          contents: node.content || '',
        },
      };
    }
  }

  return result;
}

export const webContainerService: WebContainerService = {
  boot: async () => {
    if (webcontainerInstance) {
      return webcontainerInstance;
    }

    if (isBooting) {
      // Wait for existing boot process
      while (isBooting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return webcontainerInstance!;
    }

    isBooting = true;
    
    try {
      console.log('🚀 Booting WebContainer...');
      webcontainerInstance = await WebContainer.boot();
      console.log('✅ WebContainer booted successfully!');
      return webcontainerInstance;
    } catch (error) {
      console.error('❌ Failed to boot WebContainer:', error);
      throw error;
    } finally {
      isBooting = false;
    }
  },

  getInstance: () => webcontainerInstance,

  writeFiles: async (files: FileNode[]) => {
    const container = await webContainerService.boot();
    const webContainerFiles = convertToWebContainerFiles(files);
    
    console.log('📁 Writing files to WebContainer...', webContainerFiles);
    await container.mount(webContainerFiles);
    console.log('✅ Files written successfully!');
  },

  runCommand: async (command: string, args: string[] = []) => {
    const container = await webContainerService.boot();
    
    console.log(`🔧 Running: ${command} ${args.join(' ')}`);
    
    const process = await container.spawn(command, args);
    
    let output = '';
    
    process.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
          console.log(data);
        },
      })
    );

    const exitCode = await process.exit;
    
    return { output, exitCode };
  },

  startDevServer: async (command: string, args: string[] = []) => {
    const container = await webContainerService.boot();
    
    console.log(`🚀 Starting dev server: ${command} ${args.join(' ')}`);
    
    const process = await container.spawn(command, args);
    
    process.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log(data);
        },
      })
    );

    return new Promise((resolve) => {
      container.on('server-ready', (port, url) => {
        console.log(`✅ Server ready at ${url} (port ${port})`);
        resolve({ url, process });
      });
    });
  },

  onServerReady: (callback: (port: number, url: string) => void) => {
    if (webcontainerInstance) {
      webcontainerInstance.on('server-ready', callback);
    }
  },
};

// Helper to install dependencies
export async function installDependencies(
  onOutput?: (data: string) => void
): Promise<{ success: boolean; output: string }> {
  const container = await webContainerService.boot();
  
  console.log('📦 Installing dependencies...');
  
  const process = await container.spawn('npm', ['install']);
  
  let output = '';
  
  process.output.pipeTo(
    new WritableStream({
      write(data) {
        output += data;
        onOutput?.(data);
        console.log(data);
      },
    })
  );

  const exitCode = await process.exit;
  
  return {
    success: exitCode === 0,
    output,
  };
}

// Helper to run npm scripts
export async function runNpmScript(
  script: string,
  onOutput?: (data: string) => void
): Promise<{ url?: string; process: any }> {
  const container = await webContainerService.boot();
  
  console.log(`🏃 Running npm ${script}...`);
  
  const process = await container.spawn('npm', ['run', script]);
  
  process.output.pipeTo(
    new WritableStream({
      write(data) {
        onOutput?.(data);
        console.log(data);
      },
    })
  );

  return new Promise((resolve) => {
    container.on('server-ready', (port, url) => {
      resolve({ url, process });
    });

    // If no server starts within 30s, resolve anyway
    setTimeout(() => {
      resolve({ process });
    }, 30000);
  });
}
