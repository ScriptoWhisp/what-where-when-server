import { Module } from '@nestjs/common';
import { PlayerController } from './player.controller';
import { PrismaModule } from '../../repository/prisma/prisma.module';
import { GameRepository } from '../../repository/game.repository';
import { PlayerService } from './player.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlayerController],
  providers: [
    PlayerService,
    GameRepository,
  ],
})
export class PlayerModule {}
