import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../repository/prisma/prisma.module';
import { GameRepository } from '../repository/game.repository';
import { GameEngineService } from './main/service/game-engine.service';
import { GameEngineGateway } from './main/controller/game-engine.gateway';
import { WsJwtGuard } from './main/guards/ws-jwt.guard';
import { GameCacheService } from './main/service/game-cache.service';
import { AppConfigModule } from '../config/app-config.module';
import { buildJwtModuleOptions } from '../config/jwt.config';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: buildJwtModuleOptions,
    }),
  ],
  providers: [
    GameEngineService,
    GameEngineGateway,
    GameRepository,
    WsJwtGuard,
    GameCacheService,
  ],
  exports: [GameEngineService, GameRepository],
})
export class GameEngineModule {}
