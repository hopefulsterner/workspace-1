import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CollaborationService } from './collaboration.service';
import { YjsService } from './yjs.service';
import { RedisService } from './redis.service';
import { CrdtService } from './crdt.service';
import { CollaborationGateway } from './collaboration.gateway';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { LoggerModule } from '../../common/services/logger.module';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, LoggerModule],
  providers: [
    CollaborationService,
    YjsService,
    RedisService,
    CrdtService,
    CollaborationGateway,
  ],
  exports: [
    CollaborationService,
    YjsService,
    RedisService,
    CrdtService,
  ],
})
export class CollaborationModule {}
