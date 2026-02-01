export enum GamePhase {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  ANSWERING = 'ANSWERING',
}

export class JoinRoomDto {
  gameId: number;
}

export class StartQuestionDto {
  gameId: number;
  questionId: number;
}

export class SubmitAnswerDto {
  gameId: number;
  participantId: number;
  answer: string;
}

export class GetAnswersDto {
  gameId: number;
  questionId: number;
}

export class JudgeAnswerDto {
  gameId: number;
  answerId: number;
  verdict: string;
}

export class DisputeDto {
  gameId: number;
  answerId: number;
  comment?: string;
}

export class AdjustTimeDto {
  gameId: number;
  delta: number;
}

export interface GameState {
  phase: GamePhase;
  seconds: number;
  isPaused: boolean;
}
