import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { FilesService } from '../../files/files.service';

interface CreateFileRequest {
  projectId: string;
  userId: string;
  path: string;
  name: string;
  content?: string;
  type?: string;
}

interface GetFileRequest {
  fileId: string;
  userId: string;
}

interface ListFilesRequest {
  projectId: string;
  userId: string;
  pathPrefix?: string;
  includeContent?: boolean;
}

interface UpdateFileRequest {
  fileId: string;
  userId: string;
  content: string;
}

interface DeleteFileRequest {
  fileId: string;
  userId: string;
}

interface RenameFileRequest {
  fileId: string;
  userId: string;
  newName: string;
  newPath: string;
}

interface BatchCreateFilesRequest {
  projectId: string;
  userId: string;
  files: Array<{
    path: string;
    name: string;
    content?: string;
    type?: string;
  }>;
}

interface File {
  id: string;
  projectId: string;
  path: string;
  name: string;
  content: string;
  type: string;
  language: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

interface FileResponse {
  success: boolean;
  file?: File;
  error?: string;
}

interface ListFilesResponse {
  success: boolean;
  files: File[];
  total: number;
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

interface BatchFilesResponse {
  success: boolean;
  files: File[];
  createdCount: number;
  errors: string[];
}

@Controller()
export class FileGrpcController {
  constructor(private readonly filesService: FilesService) {}

  @GrpcMethod('FileService', 'CreateFile')
  async createFile(request: CreateFileRequest): Promise<FileResponse> {
    try {
      const file = await this.filesService.create(request.userId, {
        projectId: request.projectId,
        path: request.path,
        name: request.name,
        content: request.content,
        type: request.type as 'FILE' | 'FOLDER',
      });

      return {
        success: true,
        file: this.mapFile(file),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @GrpcMethod('FileService', 'GetFile')
  async getFile(request: GetFileRequest): Promise<FileResponse> {
    try {
      const file = await this.filesService.findOne(request.fileId, request.userId);

      return {
        success: true,
        file: this.mapFile(file),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @GrpcMethod('FileService', 'ListFiles')
  async listFiles(request: ListFilesRequest): Promise<ListFilesResponse> {
    try {
      let files = await this.filesService.findByProject(
        request.projectId,
        request.userId,
      );

      // Filter by path prefix if provided
      if (request.pathPrefix) {
        files = files.filter(f => f.path.startsWith(request.pathPrefix!));
      }

      return {
        success: true,
        files: files.map(f => this.mapFile(f, request.includeContent)),
        total: files.length,
      };
    } catch (error) {
      return {
        success: false,
        files: [],
        total: 0,
      };
    }
  }

  @GrpcMethod('FileService', 'UpdateFile')
  async updateFile(request: UpdateFileRequest): Promise<FileResponse> {
    try {
      const file = await this.filesService.update(request.fileId, request.userId, {
        content: request.content,
      });

      return {
        success: true,
        file: this.mapFile(file),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @GrpcMethod('FileService', 'DeleteFile')
  async deleteFile(request: DeleteFileRequest): Promise<DeleteResponse> {
    try {
      await this.filesService.remove(request.fileId, request.userId);
      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  @GrpcMethod('FileService', 'RenameFile')
  async renameFile(request: RenameFileRequest): Promise<FileResponse> {
    try {
      const file = await this.filesService.rename(
        request.fileId,
        request.userId,
        request.newName,
        request.newPath,
      );

      return {
        success: true,
        file: this.mapFile(file),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @GrpcMethod('FileService', 'BatchCreateFiles')
  async batchCreateFiles(request: BatchCreateFilesRequest): Promise<BatchFilesResponse> {
    const files: File[] = [];
    const errors: string[] = [];

    for (const fileInput of request.files) {
      try {
        const file = await this.filesService.create(request.userId, {
          projectId: request.projectId,
          path: fileInput.path,
          name: fileInput.name,
          content: fileInput.content,
          type: fileInput.type as 'FILE' | 'FOLDER',
        });
        files.push(this.mapFile(file));
      } catch (error) {
        errors.push(`${fileInput.path}: ${(error as Error).message}`);
      }
    }

    return {
      success: errors.length === 0,
      files,
      createdCount: files.length,
      errors,
    };
  }

  private mapFile(file: any, includeContent = true): File {
    return {
      id: file.id,
      projectId: file.projectId,
      path: file.path,
      name: file.name,
      content: includeContent ? (file.content || '') : '',
      type: file.type,
      language: file.language || 'plaintext',
      size: file.size || 0,
      createdAt: file.createdAt?.toISOString() || '',
      updatedAt: file.updatedAt?.toISOString() || '',
    };
  }
}
