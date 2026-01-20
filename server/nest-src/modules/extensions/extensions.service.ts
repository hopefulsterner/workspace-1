import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface Extension {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  publisher: string;
  category: string;
  downloads: number;
  rating: number;
  icon?: string;
}

@Injectable()
export class ExtensionsService {
  // Built-in extensions registry
  private readonly extensions: Extension[] = [
    {
      id: 'prettier',
      name: 'prettier',
      displayName: 'Prettier - Code formatter',
      description: 'Code formatter using prettier',
      version: '10.1.0',
      publisher: 'esbenp',
      category: 'Formatters',
      downloads: 50000000,
      rating: 4.8,
    },
    {
      id: 'eslint',
      name: 'eslint',
      displayName: 'ESLint',
      description: 'Integrates ESLint JavaScript into VS Code',
      version: '2.4.2',
      publisher: 'dbaeumer',
      category: 'Linters',
      downloads: 30000000,
      rating: 4.7,
    },
    {
      id: 'tailwindcss',
      name: 'tailwindcss-intellisense',
      displayName: 'Tailwind CSS IntelliSense',
      description: 'Intelligent Tailwind CSS tooling',
      version: '0.10.5',
      publisher: 'bradlc',
      category: 'Other',
      downloads: 10000000,
      rating: 4.9,
    },
    {
      id: 'gitlens',
      name: 'gitlens',
      displayName: 'GitLens',
      description: 'Supercharge Git',
      version: '14.5.0',
      publisher: 'gitkraken',
      category: 'Other',
      downloads: 25000000,
      rating: 4.6,
    },
    {
      id: 'copilot',
      name: 'github-copilot',
      displayName: 'GitHub Copilot',
      description: 'AI pair programmer',
      version: '1.150.0',
      publisher: 'github',
      category: 'AI',
      downloads: 15000000,
      rating: 4.5,
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  async listExtensions(query?: { category?: string; search?: string }) {
    let filtered = [...this.extensions];

    if (query?.category) {
      filtered = filtered.filter(
        ext => ext.category.toLowerCase() === query.category?.toLowerCase()
      );
    }

    if (query?.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter(
        ext =>
          ext.name.toLowerCase().includes(search) ||
          ext.displayName.toLowerCase().includes(search) ||
          ext.description.toLowerCase().includes(search)
      );
    }

    return filtered;
  }

  async getExtension(id: string) {
    return this.extensions.find(ext => ext.id === id);
  }

  async getUserExtensions(userId: string) {
    // In a real implementation, this would query the database
    return [];
  }

  async installExtension(userId: string, extensionId: string) {
    const extension = this.extensions.find(ext => ext.id === extensionId);
    if (!extension) {
      throw new Error('Extension not found');
    }
    // In a real implementation, this would save to the database
    return { installed: true, extension };
  }

  async uninstallExtension(userId: string, extensionId: string) {
    // In a real implementation, this would remove from the database
    return { uninstalled: true };
  }
}
