import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GameRepository } from '../../repository/game.repository';

@Injectable()
export class PlayerService {
  constructor(private readonly gameRepository: GameRepository) {}

  async checkGameByCode(passcode: number) {
    const game =
      await this.gameRepository.findGameByPasscodeWithTeams(passcode);

    if (!game) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Game not found',
      });
    }

    return game;
  }
}
