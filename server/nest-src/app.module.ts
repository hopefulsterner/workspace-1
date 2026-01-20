import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { FilesModule } from './modules/files/files.module';
import { AIModule } from './modules/ai/ai.module';
import { AICoreModule } from './modules/ai-core/ai-core.module';
import { TerminalModule } from './modules/terminal/terminal.module';
import { DeployModule } from './modules/deploy/deploy.module';
import { MediaModule } from './modules/media/media.module';
import { ExtensionsModule } from './modules/extensions/extensions.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { GrpcModule } from './modules/grpc/grpc.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';

// Common modules
import { PrismaModule } from './common/prisma/prisma.module';
import { LoggerModule } from './common/services/logger.module';

// Middleware
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';

// Configuration
import configuration from './config/configuration';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Database
    PrismaModule,

    // Logging
    LoggerModule,

    // Feature modules
    AuthModule,
    ProjectsModule,
    FilesModule,
    AIModule,
    AICoreModule,  // Enterprise AI Core (LangGraph, RAG, Embeddings, Prompt Orchestration)
    TerminalModule,
    DeployModule,
    MediaModule,
    ExtensionsModule,

    // Real-time
    WebSocketModule,

    // Real-time Collaboration (Yjs + CRDT)
    CollaborationModule,

    // gRPC
    GrpcModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
