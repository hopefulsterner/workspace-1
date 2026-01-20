import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { LoggerService } from './common/services/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Custom logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  const allowedOrigins = [
    'http://localhost:3000',
    'https://maula.dev',
    'https://app.maula.dev',
    'https://www.maula.dev',
  ];
  
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.endsWith('.maula.dev')) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('AI Digital Friend Zone API')
    .setDescription('Enterprise AI IDE Backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('projects', 'Project management')
    .addTag('files', 'File operations')
    .addTag('ai', 'AI services')
    .addTag('terminal', 'Terminal sessions')
    .addTag('deploy', 'Deployment services')
    .addTag('media', 'Media processing')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Connect gRPC microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: ['ai', 'project', 'file'],
      protoPath: [
        join(__dirname, 'grpc/protos/ai.proto'),
        join(__dirname, 'grpc/protos/project.proto'),
        join(__dirname, 'grpc/protos/file.proto'),
      ],
      url: process.env.GRPC_URL || '0.0.0.0:50051',
    },
  });

  // Start all microservices
  await app.startAllMicroservices();

  // Start HTTP server
  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 HTTP server running on port ${port}`);
  logger.log(`📡 gRPC server running on ${process.env.GRPC_URL || '0.0.0.0:50051'}`);
  logger.log(`📚 Swagger docs at /api/docs`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
