import { GameStatus } from '../contracts/game-engine.dto';
import { HostRole } from '../../game-client-admin/main/auth/auth.dto';

export function isGameStatus(input: unknown): input is GameStatus {
  return (
    input === GameStatus.DRAFT ||
    input === GameStatus.LIVE ||
    input === GameStatus.FINISHED
  );
}

export function coerceGameStatus(input: unknown): GameStatus {
  return isGameStatus(input) ? input : GameStatus.DRAFT;
}

export function isHostRole(input: unknown): input is HostRole {
  return (
    input === HostRole.HOST ||
    input === HostRole.SCORER ||
    input === HostRole.ADMIN
  );
}

export function coerceHostRole(input: unknown): HostRole {
  return isHostRole(input) ? input : HostRole.HOST;
}
