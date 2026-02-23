import { GameStatus } from './common.dto';

export enum GamePhase {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  ANSWERING = 'ANSWERING',
}

export enum AnswerStatus {
  UNSET = 'UNSET',
  CORRECT = 'CORRECT',
  INCORRECT = 'INCORRECT',
  DISPUTABLE = 'DISPUTABLE'
}

export interface JoinGameDto {
  gameId: number;
  teamId: number;
}

export interface StartQuestionDto {
  gameId: number;
  questionId: number;
}

export interface SubmitAnswerDto {
  gameId: number;
  participantId: number;
  answer: string;
}

export interface GetAnswersDto {
  gameId: number;
  questionId: number;
}

export interface JudgeAnswerDto {
  gameId: number;
  answerId: number;
  verdict: string;
}

export interface DisputeDto {
  gameId: number;
  answerId: number;
  comment?: string;
}

export interface AdjustTimeDto {
  gameId: number;
  delta: number;
}

export interface GameState {
  phase: GamePhase;
  seconds: number;
  isPaused: boolean;
  activeQuestionId?: number;
  status?: GameStatus;
}

export interface ParticipantDomain {
  id: number;
  teamId: number;
  gameId: number;
  socketId: string | null;
  isConnected: boolean;
  teamName: string;
}

export interface TeamSelectionDomain {
  id: number;
  name: string;
  isTaken: boolean;
}

export interface GamePublicDomain {
  id: number;
  name: string;
  teams: TeamSelectionDomain[];
}

export interface AnswerDomain {
  id: number;
  questionId: number;
  participantId: number;
  teamName: string;
  answerText: string;
  status: string;
  submittedAt: string;
}
