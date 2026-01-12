import { GameStatuses, type GameStatus } from '../contracts/common.dto';
import { HostRoles, type HostRole } from '../contracts/auth.dto';

export function isGameStatus(input: unknown): input is GameStatus {
  return (
    input === GameStatuses.DRAFT ||
    input === GameStatuses.LIVE ||
    input === GameStatuses.FINISHED
  );
}

export function coerceGameStatus(input: unknown): GameStatus {
  return isGameStatus(input) ? input : GameStatuses.DRAFT;
}

export function isHostRole(input: unknown): input is HostRole {
  return (
    input === HostRoles.HOST ||
    input === HostRoles.SCORER ||
    input === HostRoles.ADMIN
  );
}

export function coerceHostRole(input: unknown): HostRole {
  return isHostRole(input) ? input : HostRoles.HOST;
}
