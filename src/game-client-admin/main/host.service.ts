import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { GameRepository } from '../../repository/game.repository';
import { generate4DigitPasscode, parseDateOfEvent } from '../utils/game.util';
import {
  HostGameGetResponse,
  HostGamesListResponse,
  SaveGameRequest,
  SaveGameResponse,
} from '../../repository/contracts/game.dto';

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

    let code: number | undefined;
    if (!code || Number.isNaN(code)) {
      for (let i = 0; i < 10; i++) {
        const candidate = generate4DigitPasscode();
        const exists = await this.games.findByPasscode(candidate);
        if (!exists) {
          code = candidate;
          break;
        }
      }
      if (!code) code = generate4DigitPasscode();
    } else {
      const exists = await this.games.findByPasscode(code);
      if (exists) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'passcode already exists',
        });
      }
    }

    const created = await this.games.createGame({
      hostId,
      name: title,
      date,
      passcode: code,
      status: 'DRAFT',
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
