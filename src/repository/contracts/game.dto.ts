import { Prisma } from '@prisma/client';
import type { GameId, ISODateTime, GameStatus, Pagination } from './common.dto';

export const gameDetailsInclude = Prisma.validator<Prisma.GameInclude>()({
  rounds: {
    orderBy: { roundNumber: 'asc' },
    include: {
      questions: { orderBy: { questionNumber: 'asc' } },
    },
  },
  categoryLinks: { include: { category: true } },
  participants: { include: { team: true, category: true } },
});


export interface GameSettings {
  time_to_think_sec: number;
  time_to_answer_sec: number;
  time_to_dispute_end_min: number;

  show_leaderboard: boolean;
  show_questions: boolean;
  show_answers: boolean;
  can_appeal: boolean;
}

export interface GameCategory {
  id?: GameId;
  name: string;
  description?: string;
}

export interface GameTeam {
  id?: GameId;
  name: string;
  team_code: string;
  created_at?: ISODateTime;
}

export interface GameQuestion {
  id?: GameId;
  round_id?: GameId;
  question_number: number;
  text: string;
  answer: string;
  time_to_think_sec: number;
  time_to_answer_sec: number;
}

export interface GameRound {
  id?: GameId;
  round_number: number;
  name?: string;
  questions: GameQuestion[];
}

export interface HostGameDetails {
  id: GameId;
  title: string;
  date_of_event: string;
  status: GameStatus;
  passcode: string;

  settings: GameSettings;

  // Optional for now (may be removed from admin UI later)
  categories: GameCategory[];
  teams: GameTeam[];

  rounds: GameRound[];

  updated_at: ISODateTime;
  version: number;
}

export interface HostGameCard {
  id: GameId;
  title: string;
  subtitle: string;
}

export interface HostGamesListRequest {
  limit?: number;
  offset?: number;
}

export interface HostGamesListResponse {
  items: HostGameCard[];
  pagination: Pagination;
}

export interface HostGameGetResponse {
  game: HostGameDetails;
}

export interface SaveGameRequest {
  game_id: GameId;
  version: number;
  game: Omit<
    HostGameDetails,
    'id' | 'updated_at' | 'version' | 'status' | 'passcode'
  >

  deleted_round_ids?: GameId[];
  deleted_question_ids?: GameId[];
  deleted_team_ids?: GameId[];
  deleted_category_ids?: GameId[];
}

export interface SaveGameResponse {
  game: HostGameDetails;
}
