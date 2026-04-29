import { UseGuards, Logger, UseFilters } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameEngineService } from '../service/game-engine.service';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { WsExceptionsFilter } from '../filters/ws-exceptions.filter';
import type {
  AdjustTimeDto,
  DisputeDto,
  JoinGameDto,
  JudgeAnswerDto,
  StartQuestionDto,
  SubmitAnswerDto,
} from '../../../repository/contracts/game-engine.dto';
import { GameId } from '../../../repository/contracts/common.dto';
import { debounceTime, groupBy, mergeMap, Subject } from 'rxjs';
import { getAllowedOrigins, isOriginAllowed } from '../../../config/cors';
import {
  wsConnections,
  wsEventsReceivedTotal,
  wsEventsSentTotal,
  wsHandlerDurationSeconds,
} from '../../../monitoring/metrics';

/**
 * Events sent from the Host/Admin to the Server
 */
export enum AdminRequestEvent {
  Sync = 'admin:sync', // Initial synchronization: joins admin room and fetches all game data
  StartGame = 'admin:start_game', // Transitions game status from DRAFT to LIVE
  PrepareQuestion = 'admin:prepare_question', // Triggers preparation state of the question
  StartQuestion = 'admin:start_question', // Triggers the start of a specific question cycle
  JudgeAnswer = 'admin:judge_answer', // Submits host's verdict (correct/wrong) for a team's answer
  AdjustTime = 'admin:adjust_time', // Adds or subtracts seconds from the current active timer
  PauseTimer = 'admin:pause_timer', // Pauses the current question timer
  ResumeTimer = 'admin:resume_timer', // Resumes the current question timer
  NextQuestion = 'admin:next_question',
  StopQuestion = 'admin:stop_question',
  FinishGame = 'admin:finish_game',
}

/**
 * Events sent from the Server specifically to Admins
 */
export enum AdminResponseEvent {
  AnswerUpdate = 'admin:answer_update', // Pushes a single AnswerDomain object when a team submits or host judges
  NewDispute = 'admin:new_dispute', // Notifies admins about a team raising a dispute
}

/**
 * Events sent from the Player to the Server
 */
export enum PlayerRequestEvent {
  JoinGame = 'join_game', // Initial request to join the public game room
  SubmitAnswer = 'player:submit_answer', // Sends the team's answer text to the server
  Dispute = 'player:dispute', // Team challenges a host's verdict
  SyncHistory = 'sync_history',
  SyncLeaderboard = 'sync_leaderboard',
}

/**
 * Events sent from the Server specifically to a Player
 */
export enum PlayerResponseEvent {
  AnswerReceived = 'answer_received', // Confirmation that the team's answer was successfully saved
  HistoryUpdate = 'history_update',
}

/**
 * Global broadcast events sent by the Server to all connected clients in the game room
 */
export enum GameBroadcastEvent {
  SyncState = 'sync_state', // Response to sync requests: provides current phase, timer, and active question
  TimerUpdate = 'timer_update', // Periodic tick providing current seconds and active phase
  StatusChanged = 'game_status_changed', // Notification when game moves to LIVE or FINISHED status
  LeaderboardUpdate = 'leaderboard_update', // Pushes the latest team scores/rankings
  TimerPaused = 'timer_paused',
  TimerResumed = 'timer_resumed',
}

@UseFilters(WsExceptionsFilter)
@WebSocketGateway({
  cors: {
    origin: (
      requestOrigin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      cb(null, isOriginAllowed(requestOrigin, getAllowedOrigins()));
    },
    credentials: true,
  },
  namespace: 'game',
})
export class GameEngineGateway implements OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(GameEngineGateway.name);
  private readonly leaderboardUpdate$ = new Subject<number>();

  constructor(private readonly gameService: GameEngineService) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  afterInit(_server: Server) {
    this.leaderboardUpdate$
      .pipe(
        groupBy((gameId) => gameId),
        mergeMap((group$) => group$.pipe(debounceTime(500))),
      )
      .subscribe(async (gameId) => {
        const leaderboard = await this.gameService.getLeaderboard(gameId);
        wsEventsSentTotal.labels(GameBroadcastEvent.LeaderboardUpdate).inc(1);
        this.server
          .to(this.getRoom(gameId))
          .emit(GameBroadcastEvent.LeaderboardUpdate, leaderboard);
      });
    this.logger.log('Leaderboard debouncer initialized');
  }

  private requestLeaderboardUpdate(gameId: number) {
    this.leaderboardUpdate$.next(gameId);
  }

  handleConnection(client: Socket) {
    // Socket.IO already scoped to namespace "game" via @WebSocketGateway config.
    wsConnections.labels('/game').inc(1);
    void client;
  }

  @SubscribeMessage(PlayerRequestEvent.SyncHistory)
  async handleSyncHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { participantId: number },
  ) {
    const end = wsHandlerDurationSeconds.labels(PlayerRequestEvent.SyncHistory).startTimer();
    wsEventsReceivedTotal.labels(PlayerRequestEvent.SyncHistory).inc(1);
    const history = await this.gameService.getTeamHistory(data.participantId);
    wsEventsSentTotal.labels(PlayerResponseEvent.HistoryUpdate).inc(1);
    client.emit(PlayerResponseEvent.HistoryUpdate, history);
    end();
  }

  @SubscribeMessage(PlayerRequestEvent.SyncLeaderboard)
  async handleSyncLeaderboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: GameId },
  ) {
    const end = wsHandlerDurationSeconds.labels(PlayerRequestEvent.SyncLeaderboard).startTimer();
    wsEventsReceivedTotal.labels(PlayerRequestEvent.SyncLeaderboard).inc(1);
    const leaderboard = await this.gameService.getLeaderboard(data.gameId);
    wsEventsSentTotal.labels(GameBroadcastEvent.LeaderboardUpdate).inc(1);
    client.emit(GameBroadcastEvent.LeaderboardUpdate, leaderboard);
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.StopQuestion)
  async handleStopQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.StopQuestion).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.StopQuestion).inc(1);
    await this.ensureAdmin(data.gameId, client);
    await this.gameService.stopQuestion(data.gameId);
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.NextQuestion)
  async handleNextQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.NextQuestion).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.NextQuestion).inc(1);
    await this.ensureAdmin(data.gameId, client);

    await this.gameService.startNextQuestion(
      data.gameId,
      (gId, seconds, phase, qData) => {
        wsEventsSentTotal.labels(GameBroadcastEvent.TimerUpdate).inc(1);
        this.server.to(this.getRoom(gId)).emit(GameBroadcastEvent.TimerUpdate, {
          seconds,
          phase,
          activeQuestionId: qData?.questionId,
          activeQuestionNumber: qData?.questionNumber,
        });
      },
      (phase) => {
        this.logger.log(`Game ${data.gameId} phase changed to ${phase}`);
      },
    );
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.Sync)
  async handleAdminSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.Sync).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.Sync).inc(1);
    await this.ensureAdmin(data.gameId, client);
    client.join(this.getAdminRoom(data.gameId));
    client.join(this.getRoom(data.gameId));
    wsEventsSentTotal.labels(GameBroadcastEvent.SyncState).inc(1);
    client.emit(
      GameBroadcastEvent.SyncState,
      await this.gameService.adminSyncGame(data.gameId),
    );
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.StartGame)
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.StartGame).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.StartGame).inc(1);
    await this.ensureAdmin(data.gameId, client);

    const currentStatus = await this.gameService.startGame(data.gameId);

    wsEventsSentTotal.labels(GameBroadcastEvent.StatusChanged).inc(1);
    this.server
      .to(this.getRoom(data.gameId))
      .emit(GameBroadcastEvent.StatusChanged, {
        status: currentStatus,
      });
    end();
  }

  async handleDisconnect(client: Socket) {
    wsConnections.labels('/game').dec(1);
    const end = wsHandlerDurationSeconds.labels('disconnect').startTimer();
    const result = await this.gameService.disconnectParticipant(client.id);

    if (result && result.gameId) {
      wsEventsSentTotal.labels(GameBroadcastEvent.SyncState).inc(1);
      this.server
        .to(this.getAdminRoom(result.gameId))
        .emit(GameBroadcastEvent.SyncState, {
          participants: result.participants,
        });
    }
    end();
  }

  @SubscribeMessage(PlayerRequestEvent.JoinGame)
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinGameDto,
  ) {
    const end = wsHandlerDurationSeconds.labels(PlayerRequestEvent.JoinGame).startTimer();
    wsEventsReceivedTotal.labels(PlayerRequestEvent.JoinGame).inc(1);
    let config: Awaited<
      ReturnType<GameEngineService['getGameConfigAndJoinGame']>
    >;
    try {
      config = await this.gameService.getGameConfigAndJoinGame(
        data.gameId,
        data.teamId,
        client.id,
      );
    } catch (e) {
      // Surface a stable, user-friendly message for join failures.
      const message =
        e instanceof Error && e.message.startsWith('Cannot join')
          ? e.message
          : 'Cannot join game';
      client.emit('error', { message });
      end();
      return;
    }

    client.data.participantId = config.participantId;
    client.data.gameId = data.gameId;

    client.join(this.getRoom(data.gameId));
    wsEventsSentTotal.labels(GameBroadcastEvent.SyncState).inc(1);
    client.emit(GameBroadcastEvent.SyncState, {
      state: config.state,
      participantId: config.participantId,
    });

    wsEventsSentTotal.labels(GameBroadcastEvent.SyncState).inc(1);
    this.server
      .to(this.getAdminRoom(data.gameId))
      .emit(GameBroadcastEvent.SyncState, {
        participants: config.participants,
      });

    this.logger.log(
      `Client ${client.id} joined team ${data.teamId} in game ${data.gameId}`,
    );
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.PrepareQuestion)
  async handlePrepare(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartQuestionDto,
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.PrepareQuestion).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.PrepareQuestion).inc(1);
    await this.ensureAdmin(data.gameId, client);

    await this.gameService.prepareQuestion(
      data.gameId,
      data.questionId,
      (gId, seconds, phase, qData) => {
        wsEventsSentTotal.labels(GameBroadcastEvent.TimerUpdate).inc(1);
        this.server.to(this.getRoom(gId)).emit(GameBroadcastEvent.TimerUpdate, {
          seconds,
          phase,
          activeQuestionId: qData?.questionId,
          activeQuestionNumber: qData?.questionNumber,
        });
      },
      (phase) => {
        this.logger.log(`Game ${data.gameId} phase changed to ${phase}`);
      },
    );
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.StartQuestion)
  async handleStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: StartQuestionDto,
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.StartQuestion).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.StartQuestion).inc(1);
    await this.ensureAdmin(data.gameId, client);

    await this.gameService.startQuestionCycle(data.gameId);
    end();
  }

  @SubscribeMessage(PlayerRequestEvent.SubmitAnswer)
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubmitAnswerDto,
  ) {
    const end = wsHandlerDurationSeconds.labels(PlayerRequestEvent.SubmitAnswer).startTimer();
    wsEventsReceivedTotal.labels(PlayerRequestEvent.SubmitAnswer).inc(1);
    if (!this.ensureSocketOwnsParticipant(client, data.participantId, data.gameId)) {
      client.emit('error', { message: 'Forbidden: socket does not own this participant' });
      end();
      return;
    }

    const result = await this.gameService.processAnswer(data);

    if (result) {
      wsEventsSentTotal.labels(PlayerResponseEvent.AnswerReceived).inc(1);
      client.emit(PlayerResponseEvent.AnswerReceived, { status: 'ok' });
      wsEventsSentTotal.labels(AdminResponseEvent.AnswerUpdate).inc(1);
      this.server
        .to(this.getAdminRoom(data.gameId))
        .emit(AdminResponseEvent.AnswerUpdate, result);
    }
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.JudgeAnswer)
  async handleJudge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JudgeAnswerDto,
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.JudgeAnswer).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.JudgeAnswer).inc(1);
    await this.ensureAdmin(data.gameId, client);

    const { updatedAnswer, history, socketId } =
      await this.gameService.judgeAnswer(
        data.gameId,
        data.answerId,
        data.verdict,
        client['user'].sub,
      );

    wsEventsSentTotal.labels(AdminResponseEvent.AnswerUpdate).inc(1);
    this.server
      .to(this.getAdminRoom(data.gameId))
      .emit(AdminResponseEvent.AnswerUpdate, updatedAnswer);

    this.requestLeaderboardUpdate(data.gameId);

    if (socketId) {
      wsEventsSentTotal.labels(PlayerResponseEvent.HistoryUpdate).inc(1);
      this.server.to(socketId).emit(PlayerResponseEvent.HistoryUpdate, history);
    }
    end();
  }

  @SubscribeMessage(PlayerRequestEvent.Dispute)
  async handleDispute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DisputeDto,
  ) {
    const end = wsHandlerDurationSeconds.labels(PlayerRequestEvent.Dispute).startTimer();
    wsEventsReceivedTotal.labels(PlayerRequestEvent.Dispute).inc(1);
    if (!this.ensureSocketBelongsToGame(client, data.gameId)) {
      client.emit('error', {
        message: 'Forbidden: socket is not part of this game',
      });
      end();
      return;
    }

    let result: Awaited<ReturnType<GameEngineService['raiseDispute']>>;
    try {
      result = await this.gameService.raiseDispute(
        data.gameId,
        data.answerId,
        data.comment || 'No comment provided',
      );
    } catch (e) {
      const allowed = ['Game not found', 'Appeals are disabled for this game'];
      const message =
        e instanceof Error && allowed.includes(e.message)
          ? e.message
          : 'Cannot raise dispute';
      client.emit('error', { message });
      end();
      return;
    }

    const { updatedAnswer, leaderboard } = result;

    wsEventsSentTotal.labels(AdminResponseEvent.AnswerUpdate).inc(1);
    this.server
      .to(this.getAdminRoom(data.gameId))
      .emit(AdminResponseEvent.AnswerUpdate, updatedAnswer);

    wsEventsSentTotal.labels(AdminResponseEvent.NewDispute).inc(1);
    this.server
      .to(this.getAdminRoom(data.gameId))
      .emit(AdminResponseEvent.NewDispute, { answerId: data.answerId });

    wsEventsSentTotal.labels(GameBroadcastEvent.LeaderboardUpdate).inc(1);
    this.server
      .to(this.getRoom(data.gameId))
      .emit(GameBroadcastEvent.LeaderboardUpdate, leaderboard);
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.PauseTimer)
  async handlePause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.PauseTimer).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.PauseTimer).inc(1);
    await this.ensureAdmin(data.gameId, client);
    await this.gameService.pauseTimer(data.gameId);
    wsEventsSentTotal.labels(GameBroadcastEvent.TimerPaused).inc(1);
    this.server
      .to(this.getRoom(data.gameId))
      .emit(GameBroadcastEvent.TimerPaused);
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.ResumeTimer)
  async handleResume(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.ResumeTimer).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.ResumeTimer).inc(1);
    await this.ensureAdmin(data.gameId, client);
    await this.gameService.resumeTimer(data.gameId);
    wsEventsSentTotal.labels(GameBroadcastEvent.TimerResumed).inc(1);
    this.server
      .to(this.getRoom(data.gameId))
      .emit(GameBroadcastEvent.TimerResumed);
    end();
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.AdjustTime)
  async handleAdjust(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: AdjustTimeDto,
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.AdjustTime).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.AdjustTime).inc(1);
    await this.ensureAdmin(data.gameId, client);
    await this.gameService.adjustTime(data.gameId, data.delta);
    end();
  }

  private async ensureAdmin(gameId: number, client: Socket) {
    const userId = client['user']?.sub;
    const isAdmin = await this.gameService.validateHost(gameId, userId);
    if (!isAdmin) {
      throw new WsException('Forbidden: You are not the host of this game');
    }
  }

  /**
   * Ensures the socket has joined the given game (via JoinGame) and that the
   * provided participantId matches the one bound to this socket. Prevents a
   * client from submitting answers on behalf of another team.
   */
  private ensureSocketOwnsParticipant(
    client: Socket,
    participantId: number,
    gameId: number,
  ): boolean {
    const boundParticipantId = client.data?.participantId as number | undefined;
    const boundGameId = client.data?.gameId as number | undefined;
    return (
      boundParticipantId !== undefined &&
      boundGameId !== undefined &&
      boundParticipantId === participantId &&
      boundGameId === gameId
    );
  }

  private ensureSocketBelongsToGame(client: Socket, gameId: number): boolean {
    const boundGameId = client.data?.gameId as number | undefined;
    return boundGameId !== undefined && boundGameId === gameId;
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage(AdminRequestEvent.FinishGame)
  async handleFinishGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: number },
  ) {
    const end = wsHandlerDurationSeconds.labels(AdminRequestEvent.FinishGame).startTimer();
    wsEventsReceivedTotal.labels(AdminRequestEvent.FinishGame).inc(1);
    await this.ensureAdmin(data.gameId, client);
    const status = await this.gameService.finishGame(data.gameId);

    wsEventsSentTotal.labels(GameBroadcastEvent.StatusChanged).inc(1);
    this.server
      .to(this.getRoom(data.gameId))
      .emit(GameBroadcastEvent.StatusChanged, {
        status,
      });
    end();
  }

  private getRoom(gameId: number) {
    return `game_${gameId}`;
  }

  private getAdminRoom(gameId: number) {
    return `game_${gameId}_admins`;
  }
}
