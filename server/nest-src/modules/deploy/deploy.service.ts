import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DeployProvider, DeployStatus } from '@prisma/client';
import Docker from 'dockerode';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class DeployService {
  private docker: Docker;
  private s3: S3Client | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.docker = new Docker();

    const awsConfig = this.configService.get('aws');
    if (awsConfig?.accessKeyId && awsConfig?.secretAccessKey) {
      this.s3 = new S3Client({
        region: awsConfig.region,
        credentials: {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
        },
      });
    } else {
      this.s3 = null;
    }
  }

  async getDeployments(projectId: string, userId: string) {
    return this.prisma.deployment.findMany({
      where: {
        projectId,
        project: { userId },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deploy(projectId: string, userId: string, options: {
    provider: DeployProvider;
    environment?: string;
  }) {
    // Verify project ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { files: true },
    });

    if (!project) {
      throw new BadRequestException('Project not found');
    }

    // Create deployment record
    const deployment = await this.prisma.deployment.create({
      data: {
        projectId,
        userId,
        provider: options.provider,
        status: DeployStatus.PENDING,
      },
    });

    // Start async deployment
    this.executeDeployment(deployment.id, project, options.provider);

    return deployment;
  }

  private async executeDeployment(
    deploymentId: string,
    project: any,
    provider: DeployProvider,
  ) {
    try {
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: DeployStatus.BUILDING },
      });

      let url: string;

      switch (provider) {
        case DeployProvider.AWS:
        case DeployProvider.NETLIFY:
        case DeployProvider.VERCEL:
          url = await this.deployStatic(project);
          break;
        case DeployProvider.RAILWAY:
        case DeployProvider.RENDER:
        case DeployProvider.HEROKU:
          url = await this.deployDocker(project);
          break;
        case DeployProvider.FLY_IO:
        case DeployProvider.DIGITALOCEAN:
          url = await this.deployServerless(project);
          break;
        default:
          throw new Error(`Unknown deployment provider: ${provider}`);
      }

      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: DeployStatus.DEPLOYED,
          url,
        },
      });
    } catch (error) {
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: DeployStatus.FAILED,
          logs: (error as Error).message,
        },
      });
    }
  }

  private async deployStatic(project: any): Promise<string> {
    if (!this.s3) {
      throw new Error('S3 not configured for static deployments');
    }

    const bucket = this.configService.get<string>('aws.s3Bucket');
    const region = this.configService.get<string>('aws.region');
    const prefix = `projects/${project.id}`;

    for (const file of project.files) {
      if (file.type === 'FILE') {
        await this.s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: `${prefix}${file.path}`,
          Body: file.content,
          ContentType: this.getContentType(file.name),
        }));
      }
    }

    return `https://${bucket}.s3.${region}.amazonaws.com/${prefix}/index.html`;
  }

  private async deployDocker(project: any): Promise<string> {
    // Build and deploy Docker container
    // This is a simplified example
    return `https://${project.name.toLowerCase()}.maula.dev`;
  }

  private async deployServerless(project: any): Promise<string> {
    // Deploy to serverless platform
    return `https://${project.id}.lambda-url.us-east-1.on.aws`;
  }

  private getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  async getDeploymentStatus(deploymentId: string, userId: string) {
    return this.prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: { userId },
      },
    });
  }
}
