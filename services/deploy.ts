// Deploy Service - Vercel Integration for one-click deployment

export interface DeployConfig {
  projectName: string;
  teamId?: string;
  token: string;
}

export interface DeploymentResult {
  id: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  createdAt: number;
  readyUrl?: string;
  alias?: string[];
}

export interface DeployFile {
  file: string;
  data: string; // base64 encoded content
}

// Vercel deployment
export const vercelDeploy = {
  // Deploy files to Vercel
  deploy: async (
    files: Record<string, string>,
    config: DeployConfig
  ): Promise<DeploymentResult> => {
    const { token, projectName, teamId } = config;

    // Prepare files for deployment
    const deployFiles: DeployFile[] = Object.entries(files).map(([path, content]) => ({
      file: path.startsWith('/') ? path.slice(1) : path,
      data: btoa(unescape(encodeURIComponent(content))),
    }));

    // Create deployment
    const baseUrl = 'https://api.vercel.com';
    const teamQuery = teamId ? `?teamId=${teamId}` : '';

    try {
      // First, create or get project
      const projectRes = await fetch(`${baseUrl}/v9/projects${teamQuery}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          framework: detectFramework(files),
        }),
      });

      let project;
      if (projectRes.status === 409) {
        // Project already exists, get it
        const existingRes = await fetch(`${baseUrl}/v9/projects/${projectName}${teamQuery}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        project = await existingRes.json();
      } else if (projectRes.ok) {
        project = await projectRes.json();
      } else {
        const error = await projectRes.json();
        throw new Error(error.error?.message || 'Failed to create project');
      }

      // Create deployment
      const deployRes = await fetch(`${baseUrl}/v13/deployments${teamQuery}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          project: project.id,
          target: 'production',
          files: deployFiles,
          projectSettings: {
            framework: detectFramework(files),
          },
        }),
      });

      if (!deployRes.ok) {
        const error = await deployRes.json();
        throw new Error(error.error?.message || 'Deployment failed');
      }

      const deployment = await deployRes.json();
      
      return {
        id: deployment.id,
        url: deployment.url,
        state: deployment.readyState || 'INITIALIZING',
        createdAt: deployment.createdAt,
        readyUrl: deployment.url ? `https://${deployment.url}` : undefined,
        alias: deployment.alias,
      };
    } catch (error) {
      console.error('🚀 Deploy error:', error);
      throw error;
    }
  },

  // Check deployment status
  getDeploymentStatus: async (
    deploymentId: string,
    token: string,
    teamId?: string
  ): Promise<DeploymentResult> => {
    const baseUrl = 'https://api.vercel.com';
    const teamQuery = teamId ? `?teamId=${teamId}` : '';

    const res = await fetch(`${baseUrl}/v13/deployments/${deploymentId}${teamQuery}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || 'Failed to get deployment status');
    }

    const deployment = await res.json();

    return {
      id: deployment.id,
      url: deployment.url,
      state: deployment.readyState,
      createdAt: deployment.createdAt,
      readyUrl: deployment.url ? `https://${deployment.url}` : undefined,
      alias: deployment.alias,
    };
  },

  // Wait for deployment to be ready
  waitForReady: async (
    deploymentId: string,
    token: string,
    teamId?: string,
    maxWaitMs = 120000
  ): Promise<DeploymentResult> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const status = await vercelDeploy.getDeploymentStatus(deploymentId, token, teamId);
      
      if (status.state === 'READY') {
        console.log('🚀 Deployment ready:', status.readyUrl);
        return status;
      }
      
      if (status.state === 'ERROR' || status.state === 'CANCELED') {
        throw new Error(`Deployment ${status.state.toLowerCase()}`);
      }

      // Wait 3 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    throw new Error('Deployment timeout');
  },

  // List deployments
  listDeployments: async (
    token: string,
    projectName?: string,
    teamId?: string,
    limit = 10
  ): Promise<DeploymentResult[]> => {
    const baseUrl = 'https://api.vercel.com';
    const params = new URLSearchParams();
    if (teamId) params.append('teamId', teamId);
    if (projectName) params.append('projectId', projectName);
    params.append('limit', String(limit));

    const res = await fetch(`${baseUrl}/v6/deployments?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || 'Failed to list deployments');
    }

    const data = await res.json();

    return data.deployments.map((d: any) => ({
      id: d.uid,
      url: d.url,
      state: d.state,
      createdAt: d.created,
      readyUrl: d.url ? `https://${d.url}` : undefined,
      alias: d.alias,
    }));
  },

  // Delete deployment
  deleteDeployment: async (
    deploymentId: string,
    token: string,
    teamId?: string
  ): Promise<void> => {
    const baseUrl = 'https://api.vercel.com';
    const teamQuery = teamId ? `?teamId=${teamId}` : '';

    const res = await fetch(`${baseUrl}/v13/deployments/${deploymentId}${teamQuery}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error?.message || 'Failed to delete deployment');
    }

    console.log('🗑️ Deployment deleted:', deploymentId);
  },

  // Validate token
  validateToken: async (token: string): Promise<{ valid: boolean; user?: string }> => {
    try {
      const res = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        return { valid: false };
      }

      const user = await res.json();
      return { valid: true, user: user.user?.username || user.user?.email };
    } catch {
      return { valid: false };
    }
  },
};

// Detect framework from files
function detectFramework(files: Record<string, string>): string | null {
  const fileNames = Object.keys(files);
  const packageJson = files['package.json'];
  
  let deps: Record<string, string> = {};
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      deps = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch {}
  }

  // Check for specific frameworks
  if (deps['next']) return 'nextjs';
  if (deps['nuxt'] || deps['nuxt3']) return 'nuxt';
  if (deps['@sveltejs/kit']) return 'sveltekit';
  if (deps['svelte']) return 'svelte';
  if (deps['gatsby']) return 'gatsby';
  if (deps['remix']) return 'remix';
  if (deps['astro']) return 'astro';
  if (deps['vue']) return 'vue';
  if (deps['@angular/core']) return 'angular';
  if (deps['react']) {
    if (fileNames.some(f => f.includes('vite.config'))) return 'vite';
    return 'create-react-app';
  }
  
  // Check for static sites
  if (fileNames.some(f => f === 'index.html' || f === '/index.html')) {
    return null; // Static site
  }

  return null;
}

// Export utilities for building deployable bundles
export const buildUtils = {
  // Flatten nested file structure to flat paths
  flattenFiles: (files: Record<string, any>, prefix = ''): Record<string, string> => {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(files)) {
      const path = prefix ? `${prefix}/${key}` : key;
      
      if (typeof value === 'string') {
        result[path] = value;
      } else if (typeof value === 'object' && value !== null) {
        if ('file' in value && 'contents' in value.file) {
          // WebContainer file format
          result[path] = value.file.contents;
        } else if ('directory' in value) {
          // WebContainer directory format
          Object.assign(result, buildUtils.flattenFiles(value.directory, path));
        } else {
          // Nested object (directory)
          Object.assign(result, buildUtils.flattenFiles(value, path));
        }
      }
    }
    
    return result;
  },

  // Get deployment-ready files from a project
  prepareForDeploy: (files: Record<string, string>): Record<string, string> => {
    const result: Record<string, string> = {};
    
    // Exclude development files
    const excludePatterns = [
      /node_modules/,
      /\.git/,
      /\.env\.local/,
      /\.env\.development/,
      /\.DS_Store/,
      /thumbs\.db/i,
    ];

    for (const [path, content] of Object.entries(files)) {
      const shouldExclude = excludePatterns.some(pattern => pattern.test(path));
      if (!shouldExclude) {
        result[path] = content;
      }
    }

    return result;
  },
};

// Quick deploy helper
export const quickDeploy = async (
  files: Record<string, string>,
  projectName: string,
  vercelToken: string,
  options?: {
    teamId?: string;
    waitForReady?: boolean;
    onProgress?: (status: string) => void;
  }
): Promise<DeploymentResult> => {
  const { teamId, waitForReady = true, onProgress } = options || {};

  onProgress?.('Preparing files...');
  const flatFiles = buildUtils.flattenFiles(files);
  const deployFiles = buildUtils.prepareForDeploy(flatFiles);

  onProgress?.('Creating deployment...');
  const deployment = await vercelDeploy.deploy(deployFiles, {
    projectName,
    token: vercelToken,
    teamId,
  });

  if (waitForReady) {
    onProgress?.('Waiting for deployment...');
    return vercelDeploy.waitForReady(deployment.id, vercelToken, teamId);
  }

  return deployment;
};
