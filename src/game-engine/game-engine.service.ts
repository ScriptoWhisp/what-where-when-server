import { Injectable, Logger } from '@nestjs/common';
import { GameRepository } from '../repository/game.repository';
import { GameId } from '../repository/contracts/common.dto';
import { GamePhase, GameState } from '../repository/contracts/game-engine.dto';

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);

  private readonly phase: Map<GameId, GamePhase> = new Map();
  private readonly remainingSeconds: Map<GameId, number> = new Map();
  private readonly activeTimers: Map<GameId, NodeJS.Timeout> = new Map();
  private readonly activeQuestionIds: Map<GameId, number> = new Map();

  private readonly tickCallbacks: Map<
    GameId,
    (gameId: GameId, sec: number, phase: GamePhase) => void
  > = new Map();
  private readonly phaseChangeCallbacks: Map<
    GameId,
    (phase: GamePhase) => void
  > = new Map();

  constructor(private readonly gameRepository: GameRepository) {}

  async validateHost(gameId: GameId, userId: number): Promise<boolean> {
    const game = await this.gameRepository.findById(gameId);
    return game?.hostId === userId;
  }

  public async getGameStateAndJoinGame(
    gameId: GameId,
    teamId: number,
    socketId: string,
  ): Promise<GameState> {
    const game = await this.gameRepository.teamJoinGame(
      gameId,
      teamId,
      socketId,
    );
    return this.getGameState(game.gameId);
  }

  public getGameState(gameId: number): GameState {
    return {
      phase: this.getPhase(gameId),
      seconds: this.remainingSeconds.get(gameId) ?? 0,
      isPaused:
        !this.activeTimers.has(gameId) &&
        this.getPhase(gameId) !== GamePhase.IDLE,
    };
  }

  getPhase(gameId: number): GamePhase {
    return this.phase.get(gameId) || GamePhase.IDLE;
  }

  async startQuestionCycle(
    gameId: GameId,
    questionId: number,
    onTick: (gameId: number, sec: number, phase: GamePhase) => void,
    onPhaseChange: (phase: GamePhase) => void,
  ) {
    this.cleanupTimer(gameId);

    try {
      await this.gameRepository.activateQuestion(gameId, questionId);
      this.activeQuestionIds.set(gameId, questionId);

      this.tickCallbacks.set(gameId, onTick);
      this.phaseChangeCallbacks.set(gameId, onPhaseChange);

      this.transitionToPhase(gameId, GamePhase.THINKING, 60);
    } catch (e) {
      this.logger.error(
        `Error starting cycle for game ${gameId}: ${e.message}`,
      );
      throw e;
    }
  }

  async processAnswer(gameId: number, participantId: number, text: string) {
    if (this.getPhase(gameId) !== GamePhase.ANSWERING) {
      return null;
    }

    const qId = this.activeQuestionIds.get(gameId);
    if (!qId) {
      this.logger.warn(
        `Answer received for game ${gameId} but no active question found.`,
      );
      return null;
    }

    return this.gameRepository.saveAnswer(participantId, qId, text);
  }

  async pauseTimer(gameId: GameId) {
    this.stopTimer(gameId);
    this.notifyTick(gameId);
  }

  async resumeTimer(gameId: GameId) {
    if (
      !this.activeTimers.has(gameId) &&
      this.getPhase(gameId) !== GamePhase.IDLE
    ) {
      this.startInterval(gameId);
    }
  }

  async adjustTime(gameId: GameId, delta: number) {
    const current = this.remainingSeconds.get(gameId) ?? 0;

    if (this.getPhase(gameId) === GamePhase.IDLE) return;

    let newVal = current + delta;

    if (newVal <= 0) {
      newVal = 0;
      this.remainingSeconds.set(gameId, newVal);
      this.notifyTick(gameId);
      this.handlePhaseCompletion(gameId);
    } else {
      this.remainingSeconds.set(gameId, newVal);
      this.notifyTick(gameId);
    }
  }

  private transitionToPhase(gameId: GameId, phase: GamePhase, seconds: number) {
    this.phase.set(gameId, phase);
    this.remainingSeconds.set(gameId, seconds);

    this.notifyTick(gameId);
    this.startInterval(gameId);
  }

  private startInterval(gameId: GameId) {
    if (this.activeTimers.has(gameId)) return;

    const interval = setInterval(() => {
      let current = this.remainingSeconds.get(gameId) || 0;

      if (current > 0) {
        current--;
        this.remainingSeconds.set(gameId, current);
        this.notifyTick(gameId);
      }

      if (current <= 0) {
        this.handlePhaseCompletion(gameId);
      }
    }, 1000);

    this.activeTimers.set(gameId, interval);
  }

  private handlePhaseCompletion(gameId: GameId) {
    this.stopTimer(gameId);
    const currentPhase = this.getPhase(gameId);

    if (currentPhase === GamePhase.THINKING) {
      this.transitionToPhase(gameId, GamePhase.ANSWERING, 10);
    } else if (currentPhase === GamePhase.ANSWERING) {
      this.phase.set(gameId, GamePhase.IDLE);
      this.remainingSeconds.set(gameId, 0);

      const onPhaseChange = this.phaseChangeCallbacks.get(gameId);
      if (onPhaseChange) onPhaseChange(GamePhase.IDLE);

      this.cleanupTimer(gameId);
    }
  }

  private notifyTick(gameId: GameId) {
    const onTick = this.tickCallbacks.get(gameId);
    const seconds = this.remainingSeconds.get(gameId) ?? 0;
    const phase = this.getPhase(gameId);

    if (onTick) {
      onTick(Number(gameId), seconds, phase);
    }
  }

  private stopTimer(gameId: GameId) {
    const timer = this.activeTimers.get(gameId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(gameId);
    }
  }

  private cleanupTimer(gameId: GameId) {
    this.stopTimer(gameId);
    this.activeQuestionIds.delete(gameId);
    this.tickCallbacks.delete(gameId);
    this.phaseChangeCallbacks.delete(gameId);
  }
}
