import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { GameRepository } from '../../repository/game.repository';
import { generate4DigitPasscode, parseDateOfEvent } from './utils/game.util';
import {
  HostGameGetResponse,
  HostGamesListResponse,
  SaveGameRequest,
  SaveGameResponse,
} from '../../repository/contracts/game.dto';
import { GameStatuses } from '../../repository/contracts/common.dto';

@Injectable()
export class HostService {
  constructor(private readonly games: GameRepository) {}

  async listGames(
    hostId: number,
    limit = 50,
    offset = 0,
  ): Promise<HostGamesListResponse> {
    return this.games.listHostGames({ hostId, limit, offset });
  }

  async createGame(
    hostId: number,
    title: string,
    date_of_event: string,
  ): Promise<HostGameGetResponse> {
    const date = parseDateOfEvent(date_of_event);
    const code = generate4DigitPasscode();

    const created = await this.games.createGame({
      hostId,
      name: title,
      date,
      passcode: code,
      status: GameStatuses.DRAFT,
    });

    const full = await this.games.getHostGameDetails({
      hostId,
      gameId: created.id,
    });
    if (!full) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Game not found after create',
      });
    }
    return { game: full };
  }

  async getGame(hostId: number, game_id: number): Promise<HostGameGetResponse> {
    const game = await this.games.getHostGameDetails({
      hostId,
      gameId: game_id,
    });
    if (!game) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Game not found',
      });
    }
    return { game };
  }

  async saveGame(
    hostId: number,
    req: SaveGameRequest,
  ): Promise<SaveGameResponse> {
    const game = await this.games.saveHostGame({ hostId, req });
    return { game };
  }
}
