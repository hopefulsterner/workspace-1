import { Module } from '@nestjs/common';
import { AIGrpcController } from './controllers/ai.grpc.controller';
import { ProjectGrpcController } from './controllers/project.grpc.controller';
import { FileGrpcController } from './controllers/file.grpc.controller';
import { ProjectsModule } from '../projects/projects.module';
import { FilesModule } from '../files/files.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [ProjectsModule, FilesModule, AIModule],
  controllers: [AIGrpcController, ProjectGrpcController, FileGrpcController],
})
export class GrpcModule {}
