import { describe, it, expect } from '@jest/globals';
import { GameStatuses } from '../contracts/common.dto';
import {
  coerceGameStatus,
  coerceHostRole,
  isGameStatus,
  isHostRole,
} from '../types/guards';
import { HostRoles } from '../contracts/auth.dto';


describe('repository/types/guards', () => {
  describe('GameStatus', () => {
    it('isGameStatus should accept known statuses', () => {
      expect(isGameStatus(GameStatuses.DRAFT)).toBe(true);
      expect(isGameStatus(GameStatuses.LIVE)).toBe(true);
      expect(isGameStatus(GameStatuses.FINISHED)).toBe(true);
    });

    it('isGameStatus should reject unknown values', () => {
      expect(isGameStatus('NOPE')).toBe(false);
      expect(isGameStatus(null)).toBe(false);
      expect(isGameStatus(123)).toBe(false);
      expect(isGameStatus({})).toBe(false);
    });

    it('coerceGameStatus should default to DRAFT for unknown values', () => {
      expect(coerceGameStatus('NOPE')).toBe(GameStatuses.DRAFT);
      expect(coerceGameStatus(undefined)).toBe(GameStatuses.DRAFT);
      expect(coerceGameStatus(null)).toBe(GameStatuses.DRAFT);
    });
  });

  describe('HostRole', () => {
    it('isHostRole should accept known roles', () => {
      expect(isHostRole(HostRoles.HOST)).toBe(true);
      expect(isHostRole(HostRoles.SCORER)).toBe(true);
      expect(isHostRole(HostRoles.ADMIN)).toBe(true);
    });

    it('isHostRole should reject unknown values', () => {
      expect(isHostRole('NOPE')).toBe(false);
      expect(isHostRole(null)).toBe(false);
      expect(isHostRole(123)).toBe(false);
    });

    it('coerceHostRole should default to HOST for unknown values', () => {
      expect(coerceHostRole('NOPE')).toBe(HostRoles.HOST);
      expect(coerceHostRole(undefined)).toBe(HostRoles.HOST);
      expect(coerceHostRole(null)).toBe(HostRoles.HOST);
    });
  });
});
