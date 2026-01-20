import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import LightningFS from '@isomorphic-git/lightning-fs';

// Initialize file system
const fs = new LightningFS('fs');

export interface GitStatus {
  filepath: string;
  status: 'modified' | 'added' | 'deleted' | 'unmodified' | 'untracked';
}

export interface GitCommit {
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
}

export interface GitBranch {
  name: string;
  current: boolean;
}

class GitService {
  private dir = '/project';
  private author = {
    name: 'AI Friend User',
    email: 'user@aifriend.dev',
  };

  async init(): Promise<void> {
    try {
      await git.init({ fs, dir: this.dir });
      console.log('Git repository initialized');
    } catch (error) {
      console.error('Git init error:', error);
      throw error;
    }
  }

  async clone(url: string, branch = 'main'): Promise<void> {
    try {
      // Clear existing directory
      await this.cleanDir();
      
      await git.clone({
        fs,
        http,
        dir: this.dir,
        url,
        ref: branch,
        singleBranch: true,
        depth: 10, // Shallow clone for speed
        corsProxy: 'https://cors.isomorphic-git.org',
      });
      console.log(`Cloned ${url}`);
    } catch (error) {
      console.error('Git clone error:', error);
      throw error;
    }
  }

  async status(): Promise<GitStatus[]> {
    try {
      const matrix = await git.statusMatrix({ fs, dir: this.dir });
      
      return matrix.map(([filepath, headStatus, workdirStatus, stageStatus]) => {
        let status: GitStatus['status'] = 'unmodified';
        
        if (headStatus === 0 && workdirStatus === 2 && stageStatus === 0) {
          status = 'untracked';
        } else if (headStatus === 1 && workdirStatus === 2 && stageStatus === 1) {
          status = 'modified';
        } else if (headStatus === 0 && workdirStatus === 2 && stageStatus === 2) {
          status = 'added';
        } else if (headStatus === 1 && workdirStatus === 0) {
          status = 'deleted';
        }
        
        return { filepath, status };
      }).filter(f => f.status !== 'unmodified');
    } catch (error) {
      console.error('Git status error:', error);
      return [];
    }
  }

  async add(filepath: string): Promise<void> {
    try {
      await git.add({ fs, dir: this.dir, filepath });
    } catch (error) {
      console.error('Git add error:', error);
      throw error;
    }
  }

  async addAll(): Promise<void> {
    try {
      const status = await this.status();
      for (const file of status) {
        if (file.status !== 'deleted') {
          await this.add(file.filepath);
        } else {
          await git.remove({ fs, dir: this.dir, filepath: file.filepath });
        }
      }
    } catch (error) {
      console.error('Git add all error:', error);
      throw error;
    }
  }

  async commit(message: string): Promise<string> {
    try {
      const sha = await git.commit({
        fs,
        dir: this.dir,
        message,
        author: this.author,
      });
      console.log(`Committed: ${sha}`);
      return sha;
    } catch (error) {
      console.error('Git commit error:', error);
      throw error;
    }
  }

  async log(depth = 20): Promise<GitCommit[]> {
    try {
      const commits = await git.log({ fs, dir: this.dir, depth });
      return commits.map(commit => ({
        oid: commit.oid,
        message: commit.commit.message,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          timestamp: commit.commit.author.timestamp,
        },
      }));
    } catch (error) {
      console.error('Git log error:', error);
      return [];
    }
  }

  async branches(): Promise<GitBranch[]> {
    try {
      const branchList = await git.listBranches({ fs, dir: this.dir });
      const current = await git.currentBranch({ fs, dir: this.dir });
      
      return branchList.map(name => ({
        name,
        current: name === current,
      }));
    } catch (error) {
      console.error('Git branches error:', error);
      return [];
    }
  }

  async checkout(branch: string, create = false): Promise<void> {
    try {
      if (create) {
        await git.branch({ fs, dir: this.dir, ref: branch });
      }
      await git.checkout({ fs, dir: this.dir, ref: branch });
    } catch (error) {
      console.error('Git checkout error:', error);
      throw error;
    }
  }

  async diff(filepath: string): Promise<string> {
    try {
      // Get current file content
      const currentContent = await fs.promises.readFile(
        `${this.dir}/${filepath}`,
        { encoding: 'utf8' }
      );
      
      // Get HEAD version
      const commits = await git.log({ fs, dir: this.dir, depth: 1 });
      if (commits.length === 0) {
        return `+++ New file: ${filepath}\n${currentContent}`;
      }

      const headOid = commits[0].oid;
      const { blob } = await git.readBlob({
        fs,
        dir: this.dir,
        oid: headOid,
        filepath,
      });
      
      const headContent = new TextDecoder().decode(blob);
      
      // Simple line-by-line diff
      return this.simpleDiff(headContent, currentContent as string, filepath);
    } catch (error) {
      // File might be new
      return `+++ New file: ${filepath}`;
    }
  }

  private simpleDiff(oldText: string, newText: string, filepath: string): string {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    
    let result = `--- a/${filepath}\n+++ b/${filepath}\n`;
    
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      
      if (oldLine === undefined) {
        result += `+ ${newLine}\n`;
      } else if (newLine === undefined) {
        result += `- ${oldLine}\n`;
      } else if (oldLine !== newLine) {
        result += `- ${oldLine}\n`;
        result += `+ ${newLine}\n`;
      }
    }
    
    return result || 'No changes';
  }

  async push(remote = 'origin', branch = 'main', credentials?: { username: string; password: string }): Promise<void> {
    try {
      await git.push({
        fs,
        http,
        dir: this.dir,
        remote,
        ref: branch,
        corsProxy: 'https://cors.isomorphic-git.org',
        onAuth: credentials ? () => credentials : undefined,
      });
    } catch (error) {
      console.error('Git push error:', error);
      throw error;
    }
  }

  async pull(remote = 'origin', branch = 'main', credentials?: { username: string; password: string }): Promise<void> {
    try {
      await git.pull({
        fs,
        http,
        dir: this.dir,
        ref: branch,
        singleBranch: true,
        corsProxy: 'https://cors.isomorphic-git.org',
        author: this.author,
        onAuth: credentials ? () => credentials : undefined,
      });
    } catch (error) {
      console.error('Git pull error:', error);
      throw error;
    }
  }

  setAuthor(name: string, email: string): void {
    this.author = { name, email };
  }

  private async cleanDir(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.dir);
      for (const file of files) {
        await this.recursiveDelete(`${this.dir}/${file}`);
      }
    } catch {
      // Directory doesn't exist yet
    }
  }

  private async recursiveDelete(path: string): Promise<void> {
    try {
      const stat = await fs.promises.stat(path);
      if (stat.isDirectory()) {
        const files = await fs.promises.readdir(path);
        for (const file of files) {
          await this.recursiveDelete(`${path}/${file}`);
        }
        await fs.promises.rmdir(path);
      } else {
        await fs.promises.unlink(path);
      }
    } catch {
      // Ignore errors
    }
  }

  // Get the LightningFS instance for direct file operations
  getFs() {
    return fs;
  }
}

export const gitService = new GitService();
