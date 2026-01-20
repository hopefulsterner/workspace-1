import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFileDto } from './dto/create-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(projectId: string, userId: string) {
    // Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.file.findMany({
      where: { projectId },
      orderBy: { path: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        project: { userId },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async create(userId: string, dto: CreateFileDto) {
    // Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, userId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.file.create({
      data: {
        projectId: dto.projectId,
        path: dto.path,
        name: dto.name,
        content: dto.content || '',
        type: dto.type || 'FILE',
        language: this.getLanguageFromFilename(dto.name),
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateFileDto) {
    // Verify ownership
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        project: { userId },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return this.prisma.file.update({
      where: { id },
      data: {
        content: dto.content,
        size: dto.content?.length || 0,
      },
    });
  }

  async remove(id: string, userId: string) {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        project: { userId },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    await this.prisma.file.delete({ where: { id } });
    return { message: 'File deleted' };
  }

  async rename(id: string, userId: string, newName: string, newPath: string) {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        project: { userId },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return this.prisma.file.update({
      where: { id },
      data: {
        name: newName,
        path: newPath,
        language: this.getLanguageFromFilename(newName),
      },
    });
  }

  private getLanguageFromFilename(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sql: 'sql',
      sh: 'shell',
      bash: 'shell',
      dockerfile: 'dockerfile',
      xml: 'xml',
      vue: 'vue',
      svelte: 'svelte',
    };
    return languageMap[ext || ''] || 'plaintext';
  }
}
