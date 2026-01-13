import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './repository/prisma/prisma.module';
import { HostModule } from './game-client-admin/main/host.module';
import { GameEngineModule } from './game-engine/game-engine.module';

@Module({
  imports: [AppConfigModule, PrismaModule, HostModule, GameEngineModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
