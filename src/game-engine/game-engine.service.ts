import { Injectable, Logger } from '@nestjs/common';
import { GameRepository } from '../repository/game.repository';
import { GamePhase, GameState } from './dto/game-engine.dto';

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);

  private phase: Map<string, GamePhase> = new Map();
  private remainingSeconds: Map<string, number> = new Map();
  private activeTimers: Map<string, NodeJS.Timeout> = new Map();
  private activeQuestionIds: Map<string, number> = new Map(); // ID текущего вопроса

  private tickCallbacks: Map<
    string,
    (gameId: number, sec: number, phase: GamePhase) => void
  > = new Map();
  private phaseChangeCallbacks: Map<string, (phase: GamePhase) => void> =
    new Map();

  constructor(private readonly gameRepository: GameRepository) {}

  async validateHost(gameId: number, userId: number): Promise<boolean> {
    const game = await this.gameRepository.findById(gameId);
    return game?.hostId === userId;
  }

  getGameState(gameId: number): GameState {
    const gIdStr = String(gameId);
    return {
      phase: this.getPhase(gIdStr),
      seconds: this.remainingSeconds.get(gIdStr) ?? 0,
      isPaused:
        !this.activeTimers.has(gIdStr) &&
        this.getPhase(gIdStr) !== GamePhase.IDLE,
    };
  }

  getPhase(gameId: string): GamePhase {
    return this.phase.get(gameId) || GamePhase.IDLE;
  }

  async startQuestionCycle(
    gameId: number,
    questionId: number,
    onTick: (gameId: number, sec: number, phase: GamePhase) => void,
    onPhaseChange: (phase: GamePhase) => void,
  ) {
    const gIdStr = String(gameId);
    this.cleanupTimer(gIdStr);

    try {
      await this.gameRepository.activateQuestion(gameId, questionId);
      this.activeQuestionIds.set(gIdStr, questionId);

      this.tickCallbacks.set(gIdStr, onTick);
      this.phaseChangeCallbacks.set(gIdStr, onPhaseChange);

      this.transitionToPhase(gIdStr, GamePhase.THINKING, 60);
    } catch (e) {
      this.logger.error(
        `Error starting cycle for game ${gameId}: ${e.message}`,
      );
      throw e;
    }
  }

  async processAnswer(gameId: number, participantId: number, text: string) {
    const gIdStr = String(gameId);

    if (this.getPhase(gIdStr) !== GamePhase.ANSWERING) {
      return null;
    }

    const qId = this.activeQuestionIds.get(gIdStr);
    if (!qId) {
      this.logger.warn(
        `Answer received for game ${gameId} but no active question found.`,
      );
      return null;
    }

    return this.gameRepository.saveAnswer(participantId, qId, text);
  }

  async pauseTimer(gameId: number) {
    const gIdStr = String(gameId);
    this.stopTimer(gIdStr);
    this.notifyTick(gIdStr);
  }

  async resumeTimer(gameId: number) {
    const gIdStr = String(gameId);
    if (
      !this.activeTimers.has(gIdStr) &&
      this.getPhase(gIdStr) !== GamePhase.IDLE
    ) {
      this.startInterval(gIdStr);
    }
  }

  async adjustTime(gameId: number, delta: number) {
    const gIdStr = String(gameId);
    const current = this.remainingSeconds.get(gIdStr) ?? 0;

    if (this.getPhase(gIdStr) === GamePhase.IDLE) return;

    let newVal = current + delta;

    if (newVal <= 0) {
      newVal = 0;
      this.remainingSeconds.set(gIdStr, newVal);
      this.notifyTick(gIdStr);
      this.handlePhaseCompletion(gIdStr);
    } else {
      this.remainingSeconds.set(gIdStr, newVal);
      this.notifyTick(gIdStr);
    }
  }

  private transitionToPhase(gameId: string, phase: GamePhase, seconds: number) {
    this.phase.set(gameId, phase);
    this.remainingSeconds.set(gameId, seconds);

    this.notifyTick(gameId);
    this.startInterval(gameId);
  }

  private startInterval(gameId: string) {
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

  private handlePhaseCompletion(gameId: string) {
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

  private notifyTick(gameId: string) {
    const onTick = this.tickCallbacks.get(gameId);
    const seconds = this.remainingSeconds.get(gameId) ?? 0;
    const phase = this.getPhase(gameId);

    if (onTick) {
      onTick(Number(gameId), seconds, phase);
    }
  }

  private stopTimer(gameId: string) {
    const timer = this.activeTimers.get(gameId);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(gameId);
    }
  }

  private cleanupTimer(gameId: string) {
    this.stopTimer(gameId);
    this.activeQuestionIds.delete(gameId);
    this.tickCallbacks.delete(gameId);
    this.phaseChangeCallbacks.delete(gameId);
  }
}
