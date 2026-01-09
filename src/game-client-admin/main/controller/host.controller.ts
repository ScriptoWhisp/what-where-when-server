import {
  Body,
  Controller,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { HostAuthService } from '../auth/host-auth.service';
import { HostJwtAuthGuard } from '../auth/jwt-auth.guard';
import { HostUser } from '../auth/host-user.decorator';
import type { HostJwtPayload } from '../auth/jwt.strategy';
import type {
  HostLoginRequest,
  HostLoginResponse,
  HostRegisterRequest,
  HostRegisterResponse,
  HostPassdropRequest,
  HostPassdropResponse,
} from '../dto/auth.dto';
import { HostService } from '../host.service';
import * as gameDto from '../dto/game.dto';

@Controller('host')
export class HostController {
  constructor(
    private readonly auth: HostAuthService,
    private readonly host: HostService,
  ) {}

  // ---- Auth ----

  @Post('login')
  login(@Body() body: HostLoginRequest): Promise<HostLoginResponse> {
    return this.auth.login(body.email, body.password);
  }

  @Post('register')
  register(@Body() body: HostRegisterRequest): Promise<HostRegisterResponse> {
    return this.auth.register(body.email, body.password);
  }

  @Post('passdrop')
  passdrop(@Body() body: HostPassdropRequest): HostPassdropResponse {
    return this.auth.passdrop(body.email);
  }

  // ---- Games (protected) ----

  @UseGuards(HostJwtAuthGuard)
  @Post('games')
  async listGames(
    @HostUser() host: HostJwtPayload,
    @Body() body: gameDto.HostGamesListRequest,
  ): Promise<gameDto.HostGamesListResponse> {
    return this.host.listGames(
      host.sub,
      body.limit ? Number(body.limit) : 50,
      body.offset ? Number(body.offset) : 0,
    );
  }

  @UseGuards(HostJwtAuthGuard)
  @Post('games/create')
  async createGame(
    @HostUser() host: HostJwtPayload,
    @Body() body: { title: string; date_of_event: string },
  ): Promise<gameDto.HostGameGetResponse> {
    return this.host.createGame(host.sub, body.title, body.date_of_event);
  }

  @UseGuards(HostJwtAuthGuard)
  @Post('game/get')
  async getGame(
    @HostUser() host: HostJwtPayload,
    @Body() body: {gameId: number},
  ): Promise<gameDto.HostGameGetResponse> {
    return this.host.getGame(host.sub, body.gameId);
  }

  @UseGuards(HostJwtAuthGuard)
  @Post('game/save')
  async saveGame(
    @HostUser() host: HostJwtPayload,
    @Body() body: gameDto.SaveGameRequest,
  ): Promise<gameDto.SaveGameResponse> {
    return this.host.saveGame(host.sub, body);
  }
}
