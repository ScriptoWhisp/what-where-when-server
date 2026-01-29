import { Prisma } from '@prisma/client';
import type { ID, ISODateTime, GameStatus, Pagination } from './common.dto';

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
  id?: ID;
  name: string;
  description?: string;
}

export interface GameTeam {
  id?: ID;
  name: string;
  team_code: string;
  created_at?: ISODateTime;
}

export interface GameQuestion {
  id?: ID;
  round_id?: ID;
  question_number: number;
  text: string;
  answer: string;
  time_to_think_sec: number;
  time_to_answer_sec: number;
}

export interface GameRound {
  id?: ID;
  round_number: number;
  name?: string;
  questions: GameQuestion[];
}

export interface HostGameDetails {
  id: ID;
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
  id: ID;
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
  game_id: ID;
  version: number;
  game: Omit<
    HostGameDetails,
    'id' | 'updated_at' | 'version' | 'status' | 'passcode'
  >

  deleted_round_ids?: ID[];
  deleted_question_ids?: ID[];
  deleted_team_ids?: ID[];
  deleted_category_ids?: ID[];
}

export interface SaveGameResponse {
  game: HostGameDetails;
}
