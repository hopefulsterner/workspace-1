import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { AIImageController } from './ai-image.controller';
import { AIImageService } from './ai-image.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AIController, AIImageController],
  providers: [AIService, AIImageService],
  exports: [AIService, AIImageService],
})
export class AIModule {}
