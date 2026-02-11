import { Test, TestingModule } from '@nestjs/testing';
import { GameEngineService } from '../game-engine.service';
import { GameRepository } from '../../repository/game.repository';
import { GamePhase } from '../../repository/contracts/game-engine.dto';

describe('GameEngineService', () => {
  let service: GameEngineService;
  let repository: GameRepository;

  const mockRepository = {
    activateQuestion: jest.fn(),
    saveAnswer: jest.fn(),
    findById: jest.fn(),
    teamJoinGame: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    mockRepository.activateQuestion.mockReset();
    mockRepository.saveAnswer.mockReset();
    mockRepository.findById.mockReset();

    mockRepository.activateQuestion.mockResolvedValue(undefined);
    mockRepository.saveAnswer.mockResolvedValue({ id: 1 });
    mockRepository.findById.mockResolvedValue({ hostId: 10 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameEngineService,
        { provide: GameRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<GameEngineService>(GameEngineService);
    repository = module.get<GameRepository>(GameRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('Join Logic', () => {
    it('should call repo.teamJoinGame with correct args', async () => {
      const gameId = 100;
      const teamId = 50;
      const socketId = 's_123';

      (mockRepository.teamJoinGame as jest.Mock).mockResolvedValue({
        id: 1,
        teamId: teamId,
        gameId: gameId,
      });

      await service.getGameStateAndJoinGame(gameId, teamId, socketId);

      expect(repository.teamJoinGame).toHaveBeenCalledWith(gameId, teamId, socketId);
    });
  });

  describe('Host Validation', () => {
    it('should return true if user is the host', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue({ hostId: 10 });

      const result = await service.validateHost(1, 10);
      expect(result).toBe(true);
    });

    it('should return false if user is NOT the host', async () => {
      (mockRepository.findById as jest.Mock).mockResolvedValue({ hostId: 999 });

      const result = await service.validateHost(1, 10);
      expect(result).toBe(false);
    });
  });

  describe('Game Loop (State Machine)', () => {
    it('should run full cycle: THINKING -> ANSWERING -> IDLE', async () => {
      const onTick = jest.fn();
      const onPhaseChange = jest.fn();
      const gameId = 1;

      await service.startQuestionCycle(gameId, 100, onTick, onPhaseChange);

      expect(repository.activateQuestion).toHaveBeenCalledWith(gameId, 100);
      expect(service.getPhase(1)).toBe(GamePhase.THINKING);

      jest.advanceTimersByTime(60000);
      expect(service.getPhase(1)).toBe(GamePhase.ANSWERING);

      jest.advanceTimersByTime(10000);
      expect(service.getPhase(1)).toBe(GamePhase.IDLE);
    });

    it('should throw error if database activation fails', async () => {
      (mockRepository.activateQuestion as jest.Mock).mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(
        service.startQuestionCycle(1, 100, jest.fn(), jest.fn()),
      ).rejects.toThrow('DB Error');
    });
  });

  describe('Controls: Pause & Resume', () => {
    it('should pause timer and stop ticks', async () => {
      const onTick = jest.fn();
      await service.startQuestionCycle(1, 100, onTick, jest.fn());

      jest.advanceTimersByTime(10000);
      const timeBeforePause = service.getGameState(1).seconds;

      await service.pauseTimer(1);

      jest.advanceTimersByTime(10000);
      expect(service.getGameState(1).seconds).toBe(timeBeforePause);
    });

    it('should resume timer from where it left off', async () => {
      const onTick = jest.fn();
      await service.startQuestionCycle(1, 100, onTick, jest.fn());
      await service.pauseTimer(1);

      await service.resumeTimer(1);

      jest.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenCalled();
    });
  });

  describe('Controls: Adjust Time (Edge Cases)', () => {
    it('should handle negative time adjustment (force phase switch)', async () => {
      const onTick = jest.fn();
      await service.startQuestionCycle(1, 100, onTick, jest.fn());

      await service.adjustTime(1, -70);

      expect(service.getPhase(1)).toBe(GamePhase.ANSWERING);
      expect(service.getGameState(1).seconds).toBe(10);
    });

    it('should add time correctly', async () => {
      await service.startQuestionCycle(1, 100, jest.fn(), jest.fn());
      const initial = service.getGameState(1).seconds;

      await service.adjustTime(1, 20);
      expect(service.getGameState(1).seconds).toBe(initial + 20);
    });
  });

  describe('Answering Logic', () => {
    it('should reject answer if phase is not ANSWERING', async () => {
      const result = await service.processAnswer(1, 5, 'text');
      expect(result).toBeNull();
    });

    it('should accept answer in ANSWERING phase', async () => {
      await service.startQuestionCycle(1, 100, jest.fn(), jest.fn());
      jest.advanceTimersByTime(60000);

      const result = await service.processAnswer(1, 5, 'my answer');
      expect(result).toEqual({ id: 1 });
    });
  });
});
