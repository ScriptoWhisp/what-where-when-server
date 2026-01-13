import { Injectable } from '@nestjs/common';
import { GameRepository } from '../repository/game.repository';

// TODO some enum file in /types
export type GamePhase = 'IDLE' | 'THINKING' | 'ANSWERING';

export interface TimerTickData {
  seconds: number;
  phase: GamePhase;
}

@Injectable()
export class GameEngineService {
  private activeTimers = new Map<string, NodeJS.Timeout>();
  private gamePhases = new Map<string, GamePhase>();
  private activeQuestionIds = new Map<number, number>();

  private remainingSeconds = new Map<string, number>();
  private onEndCallbacks = new Map<string, () => void>();
  private tickCallbacks = new Map<string, (data: TimerTickData) => void>();

  constructor(private readonly gameRepository: GameRepository) {}

  async validateHost(gameId: number, userId: number): Promise<boolean> {
    const game = await this.gameRepository.findById(gameId);
    return game?.hostId === userId;
  }

  async startQuestionCycle(
    gameId: number,
    questionId: number,
    onTick: (data: TimerTickData) => void,
    onPhaseEnd: (phase: GamePhase) => void,
  ) {
    await this.gameRepository.activateQuestion(gameId, questionId);
    this.activeQuestionIds.set(Number(gameId), Number(questionId));

    this.runPhase(gameId, 60, 'THINKING', onTick, () => {
      this.runPhase(gameId, 10, 'ANSWERING', onTick, () => {
        this.gamePhases.set(String(gameId), 'IDLE');
        onPhaseEnd('ANSWERING');
      });
    });
  }

  private runPhase(
    gameId: number,
    duration: number,
    phase: GamePhase,
    onTick: (data: TimerTickData) => void,
    onEnd: () => void,
  ) {
    const gIdStr = String(gameId);
    this.stopTimer(gIdStr);

    this.gamePhases.set(gIdStr, phase);
    this.remainingSeconds.set(gIdStr, duration);
    this.onEndCallbacks.set(gIdStr, onEnd);
    this.tickCallbacks.set(gIdStr, onTick);

    this.startInterval(gIdStr);
  }

  private startInterval(gIdStr: string) {
    const interval = setInterval(() => {
      const seconds = this.remainingSeconds.get(gIdStr) ?? 0;
      const phase = this.gamePhases.get(gIdStr) ?? 'IDLE';
      const onTick = this.tickCallbacks.get(gIdStr);

      if (onTick) onTick({ seconds, phase });

      if (seconds <= 0) {
        this.stopTimer(gIdStr);
        const onEnd = this.onEndCallbacks.get(gIdStr);
        if (onEnd) onEnd();
      } else {
        this.remainingSeconds.set(gIdStr, seconds - 1);
      }
    }, 1000);

    this.activeTimers.set(gIdStr, interval);
  }

  async processAnswer(gameId: number, participantId: number, text: string) {
    if (this.getPhase(String(gameId)) !== 'ANSWERING') return null;

    const qId = this.activeQuestionIds.get(Number(gameId));
    return qId
      ? this.gameRepository.saveAnswer(participantId, qId, text)
      : null;
  }

  getPhase(id: string): GamePhase {
    return this.gamePhases.get(id) || 'IDLE';
  }

  async pauseTimer(gameId: number) {
    this.stopTimer(String(gameId));
  }

  async resumeTimer(gameId: number) {
    const gIdStr = String(gameId);
    if (!this.activeTimers.has(gIdStr) && this.remainingSeconds.has(gIdStr)) {
      this.startInterval(gIdStr);
    }
  }

  async adjustTime(gameId: number, delta: number) {
    const gIdStr = String(gameId);
    const current = this.remainingSeconds.get(gIdStr) ?? 0;
    const newVal = Math.max(0, current + delta);
    this.remainingSeconds.set(gIdStr, newVal);

    const onTick = this.tickCallbacks.get(gIdStr);
    if (onTick)
      onTick({ seconds: newVal, phase: this.gamePhases.get(gIdStr) || 'IDLE' });
  }

  private stopTimer(id: string) {
    const timer = this.activeTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.activeTimers.delete(id);
    }
  }
}
