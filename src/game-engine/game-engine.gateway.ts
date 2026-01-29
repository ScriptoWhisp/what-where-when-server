import { UseGuards, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameEngineService } from './game-engine.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { GameRepository } from '../repository/game.repository';
import {
  JoinRoomDto,
  StartQuestionDto,
  SubmitAnswerDto,
  DisputeDto,
  AdjustTimeDto,
  GetAnswersDto,
  JudgeAnswerDto,
} from './dto/game-engine.dto';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'game' })
export class GameEngineGateway {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(GameEngineGateway.name);

  constructor(
    private readonly gameService: GameEngineService,
    private readonly gameRepository: GameRepository,
  ) {}

  @SubscribeMessage('join_room')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    const gId = Number(data.gameId);
    client.join(`game_${gId}`);

    const state = this.gameService.getGameState(gId);
    client.emit('sync_state', state);

    this.logger.log(`Client ${client.id} joined game_${gId}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:start_question')
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartQuestionDto,
  ) {
    await this.ensureAdmin(data.gameId, client);

    await this.gameService.startQuestionCycle(
      data.gameId,
      data.questionId,
      (gId, seconds, phase) => {
        this.server.to(`game_${gId}`).emit('timer_update', { seconds, phase });
      },
      (phase) => {
        this.logger.log(`Game ${data.gameId} phase changed to ${phase}`);
      },
    );
  }

  @SubscribeMessage('player:submit_answer')
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubmitAnswerDto,
  ) {
    const result = await this.gameService.processAnswer(
      data.gameId,
      data.participantId,
      data.answer,
    );

    if (result) {
      client.emit('answer_received', {
        status: 'ok',
        answerId: result.id,
      });

      this.server
        .to(`game_${data.gameId}`)
        .emit('team_answered', { participantId: data.participantId });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:get_answers')
  async handleGetAnswers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: GetAnswersDto,
  ) {
    await this.ensureAdmin(data.gameId, client);

    const answers = await this.gameRepository.getAnswersByQuestion(
      data.questionId,
    );
    client.emit('admin:answers_list', answers);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:judge_answer')
  async handleJudge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JudgeAnswerDto,
  ) {
    await this.ensureAdmin(data.gameId, client);

    await this.gameRepository.judgeAnswer(
      data.answerId,
      data.verdict,
      client['user'].sub,
    );

    await this.broadcastLeaderboard(data.gameId);
  }

  @SubscribeMessage('player:dispute')
  async handleDispute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DisputeDto,
  ) {
    await this.gameRepository.createDispute(
      data.answerId,
      data.comment || 'No comment provided',
    );

    this.server.to(`game_${data.gameId}`).emit('admin:new_dispute', {
      answerId: data.answerId,
    });

    await this.broadcastLeaderboard(data.gameId);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:pause_timer')
  async handlePause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    await this.ensureAdmin(data.gameId, client);
    await this.gameService.pauseTimer(data.gameId);
    this.server.to(`game_${data.gameId}`).emit('timer_paused');
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:resume_timer')
  async handleResume(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    await this.ensureAdmin(data.gameId, client);
    await this.gameService.resumeTimer(data.gameId);
    this.server.to(`game_${data.gameId}`).emit('timer_resumed');
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:adjust_time')
  async handleAdjust(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AdjustTimeDto,
  ) {
    await this.ensureAdmin(data.gameId, client);
    await this.gameService.adjustTime(data.gameId, data.delta);
  }


  private async ensureAdmin(gameId: number, client: Socket) {
    const userId = client['user']?.sub;
    const isAdmin = await this.gameService.validateHost(gameId, userId);
    if (!isAdmin) {
      throw new WsException('Forbidden: You are not the host of this game');
    }
  }

  private async broadcastLeaderboard(gameId: number) {
    const leaderboard = await this.gameRepository.getLeaderboard(gameId);
    this.server.to(`game_${gameId}`).emit('leaderboard_update', leaderboard);
  }
}
