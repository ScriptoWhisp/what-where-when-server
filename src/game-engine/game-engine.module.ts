import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GameEngineService } from './game-engine.service';
import { GameEngineGateway } from './game-engine.gateway';
import { PrismaModule } from '../repository/prisma/prisma.module';
import { GameRepository } from '../repository/game.repository';
import { WsJwtGuard } from './guards/ws-jwt.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [
    GameEngineService,
    GameEngineGateway,
    GameRepository,
    WsJwtGuard,
  ],
})
export class GameEngineModule {}
