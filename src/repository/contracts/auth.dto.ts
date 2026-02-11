import type { GameId, ISODateTime } from './common.dto';

export enum HostRoles {
  HOST = 'HOST',
  SCORER = 'SCORER',
  ADMIN = 'ADMIN',
}

export type HostRole = HostRoles.HOST | HostRoles.SCORER | HostRoles.ADMIN;

export interface HostUser {
  id: GameId;
  email: string;
  role: HostRole;
  created_at: ISODateTime;
}

export interface HostSession {
  access_token: string;
  expires_at: ISODateTime;
}

export interface HostLoginRequest {
  email: string;
  password: string;
}

export interface HostLoginResponse {
  user: HostUser;
  session: HostSession;
}

export interface HostRegisterRequest {
  email: string;
  password: string;
}

export interface HostRegisterResponse {
  user: HostUser;
  session: HostSession;
}

export interface HostPassdropRequest {
  email: string;
}

export interface HostPassdropResponse {
  message: string;
}
