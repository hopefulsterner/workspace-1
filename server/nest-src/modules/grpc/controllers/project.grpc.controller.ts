import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ProjectsService } from '../../projects/projects.service';

interface CreateProjectRequest {
  userId: string;
  name: string;
  description?: string;
  template?: string;
}

interface GetProjectRequest {
  projectId: string;
  userId: string;
}

interface ListProjectsRequest {
  userId: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

interface UpdateProjectRequest {
  projectId: string;
  userId: string;
  name?: string;
  description?: string;
  settings?: Record<string, string>;
}

interface DeleteProjectRequest {
  projectId: string;
  userId: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  template: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  deploymentCount: number;
}

interface ProjectResponse {
  success: boolean;
  project?: Project;
  error?: string;
}

interface ListProjectsResponse {
  success: boolean;
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

@Controller()
export class ProjectGrpcController {
  constructor(private readonly projectsService: ProjectsService) {}

  @GrpcMethod('ProjectService', 'CreateProject')
  async createProject(request: CreateProjectRequest): Promise<ProjectResponse> {
    try {
      const project = await this.projectsService.create(request.userId, {
        name: request.name,
        description: request.description,
        template: request.template,
      });

      return {
        success: true,
        project: this.mapProject(project),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @GrpcMethod('ProjectService', 'GetProject')
  async getProject(request: GetProjectRequest): Promise<ProjectResponse> {
    try {
      const project = await this.projectsService.findOne(
        request.projectId,
        request.userId,
      );

      return {
        success: true,
        project: this.mapProject(project),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @GrpcMethod('ProjectService', 'ListProjects')
  async listProjects(request: ListProjectsRequest): Promise<ListProjectsResponse> {
    try {
      const projects = await this.projectsService.findAll(request.userId);
      const page = request.page || 1;
      const limit = request.limit || 10;
      const start = (page - 1) * limit;
      const paged = projects.slice(start, start + limit);

      return {
        success: true,
        projects: paged.map(p => this.mapProject(p)),
        total: projects.length,
        page,
        limit,
      };
    } catch (error) {
      return {
        success: false,
        projects: [],
        total: 0,
        page: 1,
        limit: 10,
      };
    }
  }

  @GrpcMethod('ProjectService', 'UpdateProject')
  async updateProject(request: UpdateProjectRequest): Promise<ProjectResponse> {
    try {
      const project = await this.projectsService.update(
        request.projectId,
        request.userId,
        {
          name: request.name,
          description: request.description,
          settings: request.settings,
        },
      );

      return {
        success: true,
        project: this.mapProject(project),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  @GrpcMethod('ProjectService', 'DeleteProject')
  async deleteProject(request: DeleteProjectRequest): Promise<DeleteResponse> {
    try {
      await this.projectsService.remove(request.projectId, request.userId);
      return {
        success: true,
        message: 'Project deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  private mapProject(project: any): Project {
    return {
      id: project.id,
      name: project.name,
      description: project.description || '',
      template: project.template || '',
      userId: project.userId,
      createdAt: project.createdAt?.toISOString() || '',
      updatedAt: project.updatedAt?.toISOString() || '',
      fileCount: project._count?.files || 0,
      deploymentCount: project._count?.deployments || 0,
    };
  }
}
