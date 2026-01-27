import { UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameEngineService } from './game-engine.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { GameRepository } from '../repository/game.repository';

@WebSocketGateway({ cors: { origin: '*' }, namespace: 'game' })
export class GameEngineGateway {
  @WebSocketServer() server: Server;

  constructor(
    private readonly gameService: GameEngineService,
    private readonly gameRepository: GameRepository,
  ) {}

  @SubscribeMessage('join_room')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    client.join(`game_${data.gameId}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:start_question')
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number; questionId: number },
  ) {
    const isAdmin = await this.gameService.validateHost(
      data.gameId,
      client['user'].sub,
    );
    if (!isAdmin) return;

    await this.gameService.startQuestionCycle(
      data.gameId,
      data.questionId,
      (tickData) =>
        this.server.to(`game_${data.gameId}`).emit('timer_update', tickData),
      (phase) =>
        this.server.to(`game_${data.gameId}`).emit('phase_ended', { phase }),
    );
  }

  @SubscribeMessage('player:submit_answer')
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { gameId: number; participantId: number; answer: string },
  ) {
    const result = await this.gameService.processAnswer(
      data.gameId,
      data.participantId,
      data.answer,
    );
    if (result) {
      client.emit('answer_received', { status: 'ok' });
      this.server
        .to(`game_${data.gameId}`)
        .emit('team_answered', { participantId: data.participantId });
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:get_answers')
  async handleGetAnswers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number; questionId: number },
  ) {
    const isAdmin = await this.gameService.validateHost(
      data.gameId,
      client['user'].sub,
    );
    if (!isAdmin) return;

    const answers = await this.gameRepository.getAnswersByQuestion(
      data.questionId,
    );
    client.emit('admin:answers_list', answers);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:judge_answer')
  async handleJudge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number; answerId: number; verdict: string },
  ) {
    const isAdmin = await this.gameService.validateHost(
      data.gameId,
      client['user'].sub,
    );
    if (!isAdmin) return;

    await this.gameRepository.judgeAnswer(
      data.answerId,
      data.verdict,
      client['user'].sub,
    );
    const leaderboard = await this.gameRepository.getLeaderboard(data.gameId);
    this.server
      .to(`game_${data.gameId}`)
      .emit('leaderboard_update', leaderboard);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:pause_timer')
  async handlePause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    if (!(await this.gameService.validateHost(data.gameId, client['user'].sub)))
      return;
    await this.gameService.pauseTimer(data.gameId);
    this.server.to(`game_${data.gameId}`).emit('timer_paused');
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:resume_timer')
  async handleResume(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    if (!(await this.gameService.validateHost(data.gameId, client['user'].sub)))
      return;
    await this.gameService.resumeTimer(data.gameId);
    this.server.to(`game_${data.gameId}`).emit('timer_resumed');
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('admin:adjust_time')
  async handleAdjust(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number; delta: number },
  ) {
    if (!(await this.gameService.validateHost(data.gameId, client['user'].sub)))
      return;
    await this.gameService.adjustTime(data.gameId, data.delta);
  }
}