import { Body, Controller, Post } from '@nestjs/common';
import { PlayerService } from './player.service';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post('check-game')
  async checkGame(@Body() dto: CheckGameDto): Promise<CheckGameResponse> {
    return this.playerService.checkGameByCode(dto.gameCode);
  }
}

interface CheckGameDto {
  gameCode: number;
}

export interface CheckGameResponse {
  gameId: number;
  gameName: string;
  teams: Teams[]
}

interface Teams {
  teamId: number;
  name: string;
  isAvailable: boolean,
}
