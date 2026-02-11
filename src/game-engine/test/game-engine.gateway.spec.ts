import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Socket, Server } from 'socket.io';
import { GameEngineGateway } from '../game-engine.gateway';
import { GameEngineService } from '../game-engine.service';
import { GamePhase } from '../../repository/contracts/game-engine.dto';
import { GameRepository } from '../../repository/game.repository';

describe('GameEngineGateway', () => {
  let gateway: GameEngineGateway;
  let service: GameEngineService;

  const mockService = {
    validateHost: jest.fn(),
    startQuestionCycle: jest.fn(),
    getGameState: jest
      .fn()
      .mockReturnValue({ phase: GamePhase.IDLE, seconds: 0 }),
    processAnswer: jest.fn(),
    pauseTimer: jest.fn(),
    resumeTimer: jest.fn(),
    adjustTime: jest.fn(),
    joinGame: jest.fn(),
    getGameStateAndJoinGame: jest.fn(),
    teamJoinGame: jest.fn(),
  };

  const mockRepo = {
    getAnswersByQuestion: jest.fn(),
    judgeAnswer: jest.fn(),
    getLeaderboard: jest.fn(),
    createDispute: jest.fn(),
  };

  const mockSocket = {
    join: jest.fn(),
    emit: jest.fn(),
    user: { sub: 1 },
    id: 'socket_1',
  } as unknown as Socket;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  } as unknown as Server;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameEngineGateway,
        { provide: GameEngineService, useValue: mockService },
        { provide: GameRepository, useValue: mockRepo },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    gateway = module.get<GameEngineGateway>(GameEngineGateway);
    service = module.get<GameEngineService>(GameEngineService);
    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection', () => {
    it('should join room and sync state', async () => {
      const mockState = { phase: GamePhase.IDLE, seconds: 0, isPaused: false };

      (mockService.getGameStateAndJoinGame as jest.Mock).mockResolvedValue(
        mockState,
      );

      await gateway.handleJoin(mockSocket, { gameId: 10, teamId: 1 });

      expect(mockSocket.join).toHaveBeenCalledWith('game_10');

      expect(service.getGameStateAndJoinGame).toHaveBeenCalledWith(
        10,
        1,
        'socket_1',
      );

      expect(mockSocket.emit).toHaveBeenCalledWith('sync_state', mockState);
    });
  });

  describe('Admin Actions', () => {
    it('should start question cycle if admin', async () => {
      (mockService.validateHost as jest.Mock).mockResolvedValue(true);
      await gateway.handleStart(mockSocket, { gameId: 1, questionId: 5 });
      expect(service.startQuestionCycle).toHaveBeenCalled();
    });

    it('should throw Forbidden if not admin', async () => {
      (mockService.validateHost as jest.Mock).mockResolvedValue(false);
      await expect(
        gateway.handleStart(mockSocket, { gameId: 1, questionId: 5 }),
      ).rejects.toThrow('Forbidden');
    });

    it('should pause timer', async () => {
      (mockService.validateHost as jest.Mock).mockResolvedValue(true);
      await gateway.handlePause(mockSocket, { gameId: 1 });
      expect(service.pauseTimer).toHaveBeenCalledWith(1);
      expect(mockServer.emit).toHaveBeenCalledWith('timer_paused');
    });

    it('should resume timer if admin', async () => {
      (mockService.validateHost as jest.Mock).mockResolvedValue(true);
      await gateway.handleResume(mockSocket, { gameId: 1 });

      expect(service.resumeTimer).toHaveBeenCalledWith(1);
      expect(mockServer.to).toHaveBeenCalledWith('game_1');
      expect(mockServer.emit).toHaveBeenCalledWith('timer_resumed');
    });

    it('should throw Forbidden on resume if not admin', async () => {
      (mockService.validateHost as jest.Mock).mockResolvedValue(false);
      await expect(
        gateway.handleResume(mockSocket, { gameId: 1 }),
      ).rejects.toThrow('Forbidden');
    });

    it('should adjust time if admin', async () => {
      (mockService.validateHost as jest.Mock).mockResolvedValue(true);
      await gateway.handleAdjust(mockSocket, { gameId: 1, delta: 10 });

      expect(service.adjustTime).toHaveBeenCalledWith(1, 10);
    });

    it('should throw Forbidden on adjust if not admin', async () => {
      (mockService.validateHost as jest.Mock).mockResolvedValue(false);
      await expect(
        gateway.handleAdjust(mockSocket, { gameId: 1, delta: 10 }),
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('Gameplay Flow', () => {
    it('should submit answer and notify room', async () => {
      const dto = { gameId: 1, participantId: 10, answer: 'test' };
      (mockService.processAnswer as jest.Mock).mockResolvedValue({ id: 777 });

      await gateway.handleAnswer(mockSocket, dto);

      expect(mockSocket.emit).toHaveBeenCalledWith('answer_received', {
        status: 'ok',
        answerId: 777,
      });
      expect(mockServer.emit).toHaveBeenCalledWith('team_answered', {
        participantId: 10,
      });
    });

    it('should create dispute and update leaderboard', async () => {
      const dto = { gameId: 1, answerId: 5, comment: 'typo' };
      (mockRepo.getLeaderboard as jest.Mock).mockResolvedValue([]);

      await gateway.handleDispute(mockSocket, dto);

      expect(mockRepo.createDispute).toHaveBeenCalledWith(5, 'typo');
      expect(mockServer.emit).toHaveBeenCalledWith('admin:new_dispute', {
        answerId: 5,
      });
      expect(mockServer.emit).toHaveBeenCalledWith(
        'leaderboard_update',
        expect.any(Array),
      );
    });

    it('should judge answer and update leaderboard', async () => {
      const dto = { gameId: 1, answerId: 5, verdict: 'CORRECT' };
      (mockService.validateHost as jest.Mock).mockResolvedValue(true);
      (mockRepo.getLeaderboard as jest.Mock).mockResolvedValue([]);

      await gateway.handleJudge(mockSocket, dto);

      expect(mockRepo.judgeAnswer).toHaveBeenCalledWith(5, 'CORRECT', 1);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'leaderboard_update',
        expect.any(Array),
      );
    });

    it('should return answers list to admin', async () => {
      (mockService.validateHost as jest.Mock).mockResolvedValue(true);
      (mockRepo.getAnswersByQuestion as jest.Mock).mockResolvedValue([]);

      await gateway.handleGetAnswers(mockSocket, { gameId: 1, questionId: 10 });

      expect(mockSocket.emit).toHaveBeenCalledWith('admin:answers_list', []);
    });
  });
});
