import { Injectable } from '@nestjs/common';

export enum GamePhase {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  ANSWERING = 'ANSWERING',
  PAUSED = 'PAUSED',
}

interface GameState {
  remainingSeconds: number;
  phase: GamePhase;
  interval: NodeJS.Timeout | null;
  prevPhase?: GamePhase;
}

@Injectable()
export class GameService {
  private games = new Map<string, GameState>();

  private getOrCreateState(gameId: string): GameState {
    if (!this.games.has(gameId)) {
      this.games.set(gameId, {
        remainingSeconds: 0,
        phase: GamePhase.IDLE,
        interval: null,
      });
    }
    return this.games.get(gameId)!;
  }

  startQuestion(
    gameId: string,
    duration: number,
    onTick: (state: any) => void,
  ) {
    const state = this.getOrCreateState(gameId);
    this.stopInternalTimer(state);

    state.phase = GamePhase.THINKING;
    state.remainingSeconds = duration;

    this.runTimer(gameId, onTick);
  }

  private runTimer(gameId: string, onTick: (state: any) => void) {
    const state = this.games.get(gameId)!;

    state.interval = setInterval(() => {
      if (state.remainingSeconds > 0) {
        state.remainingSeconds--;
        onTick(this.getPublicState(gameId));
      } else {
        this.handlePhaseEnd(gameId, onTick);
      }
    }, 1000);
  }

  private handlePhaseEnd(gameId: string, onTick: (state: any) => void) {
    const state = this.games.get(gameId)!;
    this.stopInternalTimer(state);

    if (state.phase === GamePhase.THINKING) {
      state.phase = GamePhase.ANSWERING;
      state.remainingSeconds = 10;
      this.runTimer(gameId, onTick);
    } else {
      state.phase = GamePhase.IDLE;
      onTick(this.getPublicState(gameId));
    }
  }

  pauseTimer(gameId: string) {
    const state = this.games.get(gameId);
    if (state && state.interval) {
      this.stopInternalTimer(state);
      state.prevPhase = state.phase;
      state.phase = GamePhase.PAUSED;
    }
    return this.getPublicState(gameId);
  }

  resumeTimer(gameId: string, onTick: (state: any) => void) {
    const state = this.games.get(gameId);
    if (state && state.phase === GamePhase.PAUSED) {
      state.phase = state.prevPhase || GamePhase.THINKING;
      this.runTimer(gameId, onTick);
    }
    return this.getPublicState(gameId);
  }

  adjustTimer(gameId: string, seconds: number) {
    const state = this.games.get(gameId);

    if (!state) return null;

    state.remainingSeconds += seconds;

    if (state.remainingSeconds < 0) {
      state.remainingSeconds = 0;
    }

    return this.getPublicState(gameId);
  }

  private stopInternalTimer(state: GameState) {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  getPublicState(gameId: string) {
    const state = this.getOrCreateState(gameId);
    return {
      phase: state.phase,
      remainingSeconds: state.remainingSeconds,
    };
  }
}
