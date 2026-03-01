import { describe, it, expect } from '@jest/globals';
import {
  coerceGameStatus,
  coerceHostRole,
  isGameStatus,
  isHostRole,
} from '../types/guards';
import { GameStatus } from '../contracts/game-engine.dto';
import { HostRole } from '../../game-client-admin/main/auth/auth.dto';


describe('repository/types/guards', () => {
  describe('GameStatus', () => {
    it('isGameStatus should accept known statuses', () => {
      expect(isGameStatus(GameStatus.DRAFT)).toBe(true);
      expect(isGameStatus(GameStatus.LIVE)).toBe(true);
      expect(isGameStatus(GameStatus.FINISHED)).toBe(true);
    });

    it('isGameStatus should reject unknown values', () => {
      expect(isGameStatus('NOPE')).toBe(false);
      expect(isGameStatus(null)).toBe(false);
      expect(isGameStatus(123)).toBe(false);
      expect(isGameStatus({})).toBe(false);
    });

    it('coerceGameStatus should default to DRAFT for unknown values', () => {
      expect(coerceGameStatus('NOPE')).toBe(GameStatus.DRAFT);
      expect(coerceGameStatus(undefined)).toBe(GameStatus.DRAFT);
      expect(coerceGameStatus(null)).toBe(GameStatus.DRAFT);
    });
  });

  describe('HostRole', () => {
    it('isHostRole should accept known roles', () => {
      expect(isHostRole(HostRole.HOST)).toBe(true);
      expect(isHostRole(HostRole.SCORER)).toBe(true);
      expect(isHostRole(HostRole.ADMIN)).toBe(true);
    });

    it('isHostRole should reject unknown values', () => {
      expect(isHostRole('NOPE')).toBe(false);
      expect(isHostRole(null)).toBe(false);
      expect(isHostRole(123)).toBe(false);
    });

    it('coerceHostRole should default to HOST for unknown values', () => {
      expect(coerceHostRole('NOPE')).toBe(HostRole.HOST);
      expect(coerceHostRole(undefined)).toBe(HostRole.HOST);
      expect(coerceHostRole(null)).toBe(HostRole.HOST);
    });
  });
});
