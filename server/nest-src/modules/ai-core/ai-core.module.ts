import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { LoggerModule } from '../../common/services/logger.module';

// Services
import { EmbeddingsService } from './embeddings.service';
import { VectorStoreService } from './vector-store.service';
import { RagService } from './rag.service';
import { LangGraphService } from './langgraph.service';
import { PromptOrchestrationService } from './prompt-orchestration.service';
import { AIAgentService } from './ai-agent.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, LoggerModule],
  providers: [
    EmbeddingsService,
    VectorStoreService,
    RagService,
    LangGraphService,
    PromptOrchestrationService,
    AIAgentService,
  ],
  exports: [
    EmbeddingsService,
    VectorStoreService,
    RagService,
    LangGraphService,
    PromptOrchestrationService,
    AIAgentService,
  ],
})
export class AICoreModule {}
