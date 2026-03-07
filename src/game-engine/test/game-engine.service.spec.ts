import { Test, TestingModule } from '@nestjs/testing';
import { GameRepository } from '../../repository/game.repository';
import {
  GamePhase,
  GameStatus,
} from '../../repository/contracts/game-engine.dto';
import { GameEngineService } from '../main/service/game-engine.service';
import { GameCacheService } from '../main/service/game-cache.service';

describe('GameEngineService', () => {
  let service: GameEngineService;

  const dummyTimer = setTimeout(() => {}, 0) as unknown as NodeJS.Timeout;
  clearTimeout(dummyTimer);

  const mockGameRepository = {
    findById: jest.fn(),
    getGameStructure: jest.fn(),
    updateStatus: jest.fn(),
    activateQuestion: jest.fn(),
    saveAnswer: jest.fn(),
    teamJoinGame: jest.fn(),
    getOrderedQuestionIds: jest.fn(),
    getAnswersByGame: jest.fn(),
    getParticipantsByGame: jest.fn(),
    getQuestionSettings: jest.fn(),
    getLeaderboard: jest.fn(),
    getAnswerById: jest.fn(),
    judgeAnswer: jest.fn(),
    createDispute: jest.fn(),
    getGameSettings: jest.fn(),
  };

  const mockGameCacheService = {
    _phases: new Map(),
    _seconds: new Map(),
    _data: new Map(),
    _statuses: new Map(),
    _timers: new Map(),
    _callbacks: new Map(),

    getPhase: jest.fn(async function (id) {
      return this._phases.get(id) || GamePhase.IDLE;
    }),
    setPhase: jest.fn(async function (id, p) {
      this._phases.set(id, p);
    }),

    getStatus: jest.fn(async function (id) {
      return this._statuses.get(id);
    }),
    setStatus: jest.fn(async function (id, s) {
      this._statuses.set(id, s);
    }),

    getRemainingSeconds: jest.fn(async function (id) {
      return this._seconds.get(id) ?? 0;
    }),
    setRemainingSeconds: jest.fn(async function (id, s) {
      this._seconds.set(id, s);
    }),

    getActiveQuestionData: jest.fn(async function (id) {
      return this._data.get(id);
    }),
    setActiveQuestionData: jest.fn(async function (id, d) {
      this._data.set(id, d);
    }),

    setCallbacks: jest.fn(function (id, onTick, onPhaseChange) {
      this._callbacks.set(id, { onTick, onPhaseChange });
    }),
    getTickCallback: jest.fn(function (id) {
      return this._callbacks.get(id)?.onTick;
    }),
    getPhaseChangeCallback: jest.fn(function (id) {
      return this._callbacks.get(id)?.onPhaseChange;
    }),
    removeCallbacks: jest.fn(function (id) {
      this._callbacks.delete(id);
    }),

    getTimer: jest.fn(function (id) {
      return this._timers.get(id);
    }),
    setTimer: jest.fn(function (id, t) {
      this._timers.set(id, t);
    }),
    clearTimer: jest.fn(function (id) {
      const t = this._timers.get(id);
      if (t) clearInterval(t);
      this._timers.delete(id);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameEngineService,
        { provide: GameCacheService, useValue: mockGameCacheService },
        { provide: GameRepository, useValue: mockGameRepository },
      ],
    }).compile();

    service = module.get<GameEngineService>(GameEngineService);
    mockGameCacheService._phases.clear();
    mockGameCacheService._seconds.clear();
    mockGameCacheService._data.clear();
    mockGameCacheService._statuses.clear();
    mockGameCacheService._timers.clear();
    mockGameCacheService._callbacks.clear();


    jest.clearAllMocks();
    mockGameCacheService.getPhase.mockImplementation(async function (id) {
      return this._phases.get(id) || GamePhase.IDLE;
    });
    mockGameCacheService.getRemainingSeconds.mockImplementation(
      async function (id) {
        return this._seconds.get(id) ?? 0;
      },
    );
    mockGameCacheService.getActiveQuestionData.mockImplementation(
      async function (id) {
        return this._data.get(id);
      },
    );
    mockGameCacheService.getStatus.mockImplementation(async function (id) {
      return this._statuses.get(id);
    });
  });

  describe('startGame', () => {
    it('should transition DRAFT game to LIVE', async () => {
      const gameId = 1;
      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.DRAFT);
      mockGameRepository.updateStatus.mockResolvedValue({
        id: gameId,
        status: GameStatus.LIVE,
      });

      const result = await service.startGame(gameId);

      expect(result).toBe(GameStatus.LIVE);
      expect(mockGameRepository.updateStatus).toHaveBeenCalledWith(
        gameId,
        GameStatus.LIVE,
      );
      expect(mockGameCacheService.setStatus).toHaveBeenCalledWith(
        gameId,
        GameStatus.LIVE,
      );
    });

    it('should not update if already LIVE', async () => {
      const gameId = 1;
      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.LIVE);

      const result = await service.startGame(gameId);

      expect(result).toBe(GameStatus.LIVE);
      expect(mockGameRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should throw error if game is FINISHED', async () => {
      const gameId = 1;
      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.FINISHED);

      await expect(service.startGame(gameId)).rejects.toThrow(
        'already finished',
      );
      expect(mockGameRepository.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('prepareQuestion', () => {
    it('should set phase to PREPARATION and notify without starting timer', async () => {
      const gameId = 1;
      const questionId = 101;
      const questionNumber = 5;

      mockGameCacheService._statuses.set(gameId, GameStatus.LIVE);
      mockGameRepository.getQuestionSettings.mockResolvedValue({
        timeToThink: 60,
        questionNumber,
        gameId,
      });

      const onTick = jest.fn();
      await service.prepareQuestion(gameId, questionId, onTick, jest.fn());

      expect(mockGameCacheService._phases.get(gameId)).toBe(
        GamePhase.PREPARATION,
      );
      expect(onTick).toHaveBeenCalledWith(gameId, 0, GamePhase.PREPARATION, {
        questionId,
        questionNumber,
      });
    });
  });

  describe('startQuestionCycle', () => {
    it('should start THINKING phase only if currently in PREPARATION', async () => {
      const gameId = 1;
      mockGameCacheService.getPhase.mockResolvedValue(GamePhase.PREPARATION);
      mockGameCacheService.getActiveQuestionData.mockResolvedValue({
        questionId: 101,
        questionNumber: 5,
      });
      mockGameRepository.getQuestionSettings.mockResolvedValue({
        timeToThink: 45,
      });

      await service.startQuestionCycle(gameId);

      expect(mockGameCacheService.setPhase).toHaveBeenCalledWith(
        gameId,
        GamePhase.THINKING,
      );
      expect(mockGameCacheService.setRemainingSeconds).toHaveBeenCalledWith(
        gameId,
        45,
      );
      expect(mockGameCacheService.setTimer).toHaveBeenCalled();
    });

    it('should throw error if not in PREPARATION phase', async () => {
      mockGameCacheService.getPhase.mockResolvedValue(GamePhase.IDLE);
      await expect(service.startQuestionCycle(1)).rejects.toThrow(
        'only be started from PREPARATION',
      );
    });

    it('should transition through THINKING -> ANSWERING -> IDLE correctly', async () => {
      jest.useFakeTimers();
      const gameId = 1;
      const questionId = 101;
      const qData = { questionId, questionNumber: 1 };

      mockGameCacheService._statuses.set(gameId, GameStatus.LIVE);
      mockGameCacheService._phases.set(gameId, GamePhase.PREPARATION);
      mockGameCacheService._data.set(gameId, qData);

      mockGameRepository.getQuestionSettings.mockResolvedValue({
        timeToThink: 60,
        timeToAnswer: 10,
        gameId,
        questionNumber: 1,
      });

      const onTick = jest.fn();
      mockGameCacheService.setCallbacks(gameId, onTick, jest.fn());

      await service.startQuestionCycle(gameId);

      expect(mockGameCacheService._phases.get(gameId)).toBe(GamePhase.THINKING);
      expect(onTick).toHaveBeenCalledWith(
        gameId,
        60,
        GamePhase.THINKING,
        qData,
      );

      onTick.mockClear();

      mockGameCacheService._seconds.set(gameId, 0);
      jest.advanceTimersByTime(1000);

      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
      }

      expect(mockGameCacheService._phases.get(gameId)).toBe(
        GamePhase.ANSWERING,
      );
      expect(onTick).toHaveBeenCalledWith(
        gameId,
        10,
        GamePhase.ANSWERING,
        qData,
      );

      jest.useRealTimers();
    });
  });

  describe('startNextQuestion (Game Flow)', () => {
    it('should start the next question if it exists', async () => {
      const gameId = 1;
      const nextQuestionId = 102;

      mockGameCacheService._statuses.set(gameId, GameStatus.LIVE);

      mockGameCacheService.getActiveQuestionData.mockResolvedValue({
        questionId: 101,
        questionNumber: 1,
      });

      mockGameRepository.getOrderedQuestionIds.mockResolvedValue([
        101,
        nextQuestionId,
        103,
      ]);

      mockGameRepository.getQuestionSettings.mockResolvedValue({
        timeToThink: 60,
        questionNumber: 2,
        gameId: gameId,
      });

      const result = await service.startNextQuestion(gameId, jest.fn());

      expect(result).toBe(nextQuestionId);

      expect(mockGameRepository.activateQuestion).toHaveBeenCalledWith(
        gameId,
        nextQuestionId,
      );

      expect(mockGameCacheService._phases.get(gameId)).toBe(
        GamePhase.PREPARATION,
      );
    });

    it('should return null if no more questions', async () => {
      const gameId = 1;
      mockGameCacheService.getActiveQuestionData.mockResolvedValue({
        questionId: 103,
        questionNumber: 1,
      });
      mockGameRepository.getOrderedQuestionIds.mockResolvedValue([
        101, 102, 103,
      ]);

      const result = await service.startNextQuestion(gameId, jest.fn());

      expect(result).toBeNull();
      expect(mockGameRepository.activateQuestion).not.toHaveBeenCalled();
    });
  });

  describe('adminSyncGame', () => {
    it('should collect state, answers and participants in parallel', async () => {
      const gameId = 1;
      const mockState = {
        status: GameStatus.LIVE,
        phase: GamePhase.IDLE,
        seconds: 0,
        isPaused: false,
      };
      const mockAnswers = [{ id: 10, answerText: 'Hello' }];
      const mockParticipants = [{ id: 1, teamName: 'Team A' }];

      jest.spyOn(service, 'getGameState').mockResolvedValue(mockState);
      mockGameRepository.getAnswersByGame.mockResolvedValue(mockAnswers);
      mockGameRepository.getParticipantsByGame.mockResolvedValue(
        mockParticipants,
      );

      const result = await service.adminSyncGame(gameId);

      expect(result).toEqual({
        state: mockState,
        answers: mockAnswers,
        participants: mockParticipants,
      });

      expect(mockGameRepository.getAnswersByGame).toHaveBeenCalledWith(gameId);
      expect(mockGameRepository.getParticipantsByGame).toHaveBeenCalledWith(
        gameId,
      );
    });
  });

  describe('processAnswer (Non-blocking logic)', () => {
    it('should save answer even if phase is IDLE (marking it as late)', async () => {
      const dto = {
        gameId: 1,
        participantId: 5,
        questionId: 101,
        answer: 'Late but saved',
      };

      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.LIVE);
      mockGameCacheService.getPhase.mockResolvedValue(GamePhase.IDLE);
      mockGameCacheService.getActiveQuestionData.mockResolvedValue(null);

      const result = await service.processAnswer(dto);

      expect(mockGameRepository.saveAnswer).toHaveBeenCalledWith(
        5,
        101,
        'Late but saved',
      );
      expect(result).not.toBeNull();
    });

    it('should accept answer during THINKING phase', async () => {
      const dto = {
        gameId: 1,
        participantId: 5,
        questionId: 101,
        answer: 'Early bird',
      };

      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.LIVE);
      mockGameCacheService.getPhase.mockResolvedValue(GamePhase.THINKING);
      mockGameCacheService.getActiveQuestionData.mockResolvedValue({
        questionId: 101,
        questionNumber: 1,
      });

      const result = await service.processAnswer(dto);

      expect(result?.isLate).toBe(false);

      expect(mockGameRepository.saveAnswer).toHaveBeenCalledWith(
        5,
        101,
        'Early bird',
      );
    });

    it('should accept answer during ANSWERING phase', async () => {
      const dto = {
        gameId: 1,
        participantId: 5,
        questionId: 101,
        answer: 'Early bird',
      };

      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.LIVE);
      mockGameCacheService.getPhase.mockResolvedValue(GamePhase.ANSWERING);
      mockGameCacheService.getActiveQuestionData.mockResolvedValue({
        questionId: 101,
        questionNumber: 1,
      });

      const result = await service.processAnswer(dto);

      expect(result?.isLate).toBe(false);

      expect(mockGameRepository.saveAnswer).toHaveBeenCalledWith(
        5,
        101,
        'Early bird',
      );
    });
  });

  describe('getGameConfigAndJoinGame', () => {
    it('should allow joining a LIVE game and return config', async () => {
      const gameId = 1;
      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.LIVE);
      mockGameRepository.teamJoinGame.mockResolvedValue({ id: 10, gameId });
      jest.spyOn(service, 'getGameState').mockResolvedValue({
        status: GameStatus.LIVE,
        phase: GamePhase.IDLE,
        seconds: 0,
        isPaused: false,
      });
      mockGameRepository.getParticipantsByGame.mockResolvedValue([]);

      const result = await service.getGameConfigAndJoinGame(
        gameId,
        1,
        'socket-id',
      );

      expect(result.participantId).toBe(10);
      expect(result.state.status).toBe(GameStatus.LIVE);
      expect(mockGameRepository.teamJoinGame).toHaveBeenCalledWith(
        gameId,
        1,
        'socket-id',
      );
    });

    it('should throw error if game is FINISHED', async () => {
      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.FINISHED);

      await expect(
        service.getGameConfigAndJoinGame(1, 1, 'socket-id'),
      ).rejects.toThrow('game is already finished');
    });
  });

  describe('judgeAnswer', () => {
    it('should judge answer and return updated answer with leaderboard', async () => {
      const gameId = 1;
      const answerId = 50;
      const mockAnswer = { id: 50, answerText: 'Test', status: 'CORRECT' };
      const mockLeaderboard = [
        { participantId: 1, teamName: 'Team A', score: 10 },
      ];

      mockGameRepository.judgeAnswer.mockResolvedValue({});
      mockGameRepository.getAnswerById.mockResolvedValue(mockAnswer);
      mockGameRepository.getLeaderboard.mockResolvedValue(mockLeaderboard);

      const result = await service.judgeAnswer(gameId, answerId, 'CORRECT', 99);

      expect(result.updatedAnswer).toEqual(mockAnswer);
      expect(result.leaderboard).toEqual(mockLeaderboard);
      expect(mockGameRepository.judgeAnswer).toHaveBeenCalledWith(
        answerId,
        'CORRECT',
        99,
      );
    });
  });

  describe('raiseDispute', () => {
    it('should raise dispute if enabled in settings', async () => {
      const gameId = 1;
      mockGameRepository.getGameSettings.mockResolvedValue({
        can_appeal: true,
      });
      mockGameRepository.getAnswerById.mockResolvedValue({
        id: 50,
        status: 'DISPUTABLE',
      });
      mockGameRepository.getLeaderboard.mockResolvedValue([]);

      const result = await service.raiseDispute(gameId, 50, 'Wrong!');

      expect(mockGameRepository.createDispute).toHaveBeenCalledWith(
        50,
        'Wrong!',
      );
      expect(result.updatedAnswer.id).toBe(50);
    });

    it('should throw error if appeals are disabled', async () => {
      mockGameRepository.getGameSettings.mockResolvedValue({
        can_appeal: false,
      });

      await expect(service.raiseDispute(1, 50, 'Comment')).rejects.toThrow(
        'Appeals are disabled',
      );
    });
  });

  describe('Timer & Status Management', () => {
    it('should pause the timer and notify subscribers', async () => {
      const gameId = 1;
      const intervalId = setInterval(() => {}, 1000);

      mockGameCacheService.getTimer.mockReturnValue(intervalId);
      mockGameCacheService.getRemainingSeconds.mockResolvedValue(30);
      mockGameCacheService.getPhase.mockResolvedValue(GamePhase.THINKING);

      await service.pauseTimer(gameId);

      expect(mockGameCacheService.clearTimer).toHaveBeenCalledWith(gameId);
      expect(mockGameCacheService.getTickCallback).toHaveBeenCalled();
    });

    it('should resume the timer if it was paused', async () => {
      const gameId = 1;

      mockGameCacheService.getTimer.mockReturnValue(undefined);
      mockGameCacheService.getPhase.mockResolvedValue(GamePhase.THINKING);
      mockGameCacheService.getRemainingSeconds.mockResolvedValue(30);

      await service.resumeTimer(gameId);

      expect(mockGameCacheService.setTimer).toHaveBeenCalled();
    });

    it('should adjust time and handle completion if seconds reach 0', async () => {
      const gameId = 1;
      mockGameCacheService.getPhase.mockResolvedValue(GamePhase.THINKING);
      mockGameCacheService.getRemainingSeconds.mockResolvedValue(5);
      mockGameCacheService.getTimer.mockReturnValue(
        setInterval(() => {}, 1000)
      );

      await service.adjustTime(gameId, -10);

      expect(mockGameCacheService.setRemainingSeconds).toHaveBeenCalledWith(
        gameId,
        0,
      );
      expect(mockGameCacheService.clearTimer).toHaveBeenCalled();
    });

    it('should finish game and cleanup resources', async () => {
      const gameId = 1;
      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.LIVE);
      mockGameCacheService.getTimer.mockReturnValue(
        setInterval(() => {}, 1000)
      );

      await service.finishGame(gameId);

      expect(mockGameRepository.updateStatus).toHaveBeenCalledWith(
        gameId,
        GameStatus.FINISHED,
      );
      expect(mockGameCacheService.clearTimer).toHaveBeenCalled();
      expect(mockGameCacheService.removeCallbacks).toHaveBeenCalled();
    });
  });

  describe('stopQuestion', () => {
    it('should stop question and transition to IDLE if game is LIVE', async () => {
      const gameId = 1;
      const mockOnPhaseChange = jest.fn();

      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.LIVE);
      mockGameCacheService.getPhaseChangeCallback.mockReturnValue(
        mockOnPhaseChange,
      );
      mockGameCacheService.getTimer.mockReturnValue(
        setInterval(() => {}, 1000),
      );

      await service.stopQuestion(gameId);

      expect(mockGameCacheService.setPhase).toHaveBeenCalledWith(
        gameId,
        GamePhase.IDLE,
      );
      expect(mockGameCacheService.setRemainingSeconds).toHaveBeenCalledWith(
        gameId,
        0,
      );
      expect(mockGameCacheService.clearTimer).toHaveBeenCalledWith(gameId);
      expect(mockOnPhaseChange).toHaveBeenCalledWith(GamePhase.IDLE);
      expect(mockGameCacheService.removeCallbacks).toHaveBeenCalledWith(gameId);
    });

    it('should do nothing if game is not LIVE', async () => {
      const gameId = 1;
      mockGameCacheService.getStatus.mockResolvedValue(GameStatus.DRAFT);

      await service.stopQuestion(gameId);

      expect(mockGameCacheService.setPhase).not.toHaveBeenCalled();
    });
  });
});
