import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  parseDateOfEvent,
} from '../../../repository/utils/game.util';
import {
  HostGameGetResponse,
  HostGamesListResponse,
  SaveGameRequest,
  SaveGameResponse,
} from '../controller/host.controller';
import { GameStatus } from '../../../repository/contracts/game-engine.dto';
import { HostGameRepository } from '../../../repository/host.game.repository';


@Injectable()
export class HostService {
  constructor(
    private readonly hostGameRepository: HostGameRepository
  ) {}

  async listGames(
    hostId: number,
    limit = 50,
    offset = 0,
  ): Promise<HostGamesListResponse> {
    return this.hostGameRepository.listHostGames({ hostId, limit, offset });
  }

  async createGame(
    hostId: number,
    title: string,
    date_of_event: string,
  ): Promise<HostGameGetResponse> {
    const date = parseDateOfEvent(date_of_event);

    const created = await this.hostGameRepository.createGameWithAutoPasscode({
      hostId,
      name: title,
      date,
      status: GameStatus.DRAFT,
    });

    const full = await this.hostGameRepository.getHostGameDetails({
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
    const game = await this.hostGameRepository.getHostGameDetails({
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
    const game = await this.hostGameRepository.saveHostGame({ hostId, req });
    return { game };
  }
}
