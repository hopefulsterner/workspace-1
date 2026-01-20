import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { files: true, deployments: true },
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: {
        files: {
          orderBy: { path: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        template: dto.template,
        userId,
      },
    });

    // Create template files if specified
    if (dto.template) {
      await this.createTemplateFiles(project.id, dto.template);
    }

    return project;
  }

  async update(id: string, userId: string, dto: UpdateProjectDto) {
    const result = await this.prisma.project.updateMany({
      where: { id, userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.settings && { settings: dto.settings }),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Project not found');
    }

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    const result = await this.prisma.project.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Project not found');
    }

    return { message: 'Project deleted' };
  }

  private async createTemplateFiles(projectId: string, template: string) {
    const templates: Record<string, Array<{ path: string; name: string; content: string }>> = {
      react: [
        {
          path: '/src/App.tsx',
          name: 'App.tsx',
          content: `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <h1 className="text-4xl font-bold text-blue-600">Hello React!</h1>
    </div>
  );
}`,
        },
        {
          path: '/src/index.tsx',
          name: 'index.tsx',
          content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
        },
        {
          path: '/package.json',
          name: 'package.json',
          content: JSON.stringify({
            name: 'react-app',
            version: '1.0.0',
            scripts: {
              dev: 'vite',
              build: 'vite build',
              preview: 'vite preview',
            },
            dependencies: {
              react: '^18.2.0',
              'react-dom': '^18.2.0',
            },
            devDependencies: {
              '@types/react': '^18.2.0',
              '@types/react-dom': '^18.2.0',
              '@vitejs/plugin-react': '^4.0.0',
              typescript: '^5.0.0',
              vite: '^5.0.0',
            },
          }, null, 2),
        },
      ],
      node: [
        {
          path: '/src/index.ts',
          name: 'index.ts',
          content: `import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Node.js!' });
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});`,
        },
        {
          path: '/package.json',
          name: 'package.json',
          content: JSON.stringify({
            name: 'node-app',
            version: '1.0.0',
            main: 'dist/index.js',
            scripts: {
              dev: 'tsx watch src/index.ts',
              build: 'tsc',
              start: 'node dist/index.js',
            },
            dependencies: {
              express: '^4.18.0',
            },
            devDependencies: {
              '@types/express': '^4.17.0',
              '@types/node': '^20.0.0',
              tsx: '^4.0.0',
              typescript: '^5.0.0',
            },
          }, null, 2),
        },
      ],
    };

    const templateFiles = templates[template] || [];
    
    for (const file of templateFiles) {
      await this.prisma.file.create({
        data: {
          projectId,
          path: file.path,
          name: file.name,
          content: file.content,
          type: 'FILE',
        },
      });
    }
  }
}
