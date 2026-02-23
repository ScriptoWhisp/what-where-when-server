import { Test, TestingModule } from '@nestjs/testing';
import { GameEngineService } from '../game-engine.service';
import { GameRepository } from '../../repository/game.repository';
import { GamePhase } from '../../repository/contracts/game-engine.dto';

describe('GameEngineService', () => {
  let service: GameEngineService;
  let repository: GameRepository;

  const mockGameRepository = {
    findById: jest.fn(),
    getGameStructure: jest.fn(),
    updateStatus: jest.fn(),
    activateQuestion: jest.fn(),
    saveAnswer: jest.fn(),
    teamJoinGame: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameEngineService,
        { provide: GameRepository, useValue: mockGameRepository },
      ],
    }).compile();

    service = module.get<GameEngineService>(GameEngineService);
    repository = module.get<GameRepository>(GameRepository);
    jest.clearAllMocks();
  });

  describe('startQuestionCycle (Phases & Timers)', () => {
    it('should transition through THINKING -> ANSWERING -> IDLE correctly', async () => {
      jest.useFakeTimers();
      const gameId = 1;
      const questionId = 101;

      // Имитируем успешный ответ от БД
      mockGameRepository.activateQuestion.mockResolvedValue(null);

      const phaseChanges: GamePhase[] = [];
      // ОБЯЗАТЕЛЬНО await
      await service.startQuestionCycle(
        gameId,
        questionId,
        jest.fn(),
        (phase) => {
          phaseChanges.push(phase);
        },
      );

      // 1. Сразу после старта должна быть фаза THINKING
      expect(service.getPhase(gameId)).toBe(GamePhase.THINKING);

      // 2. Проматываем время обсуждения (60 сек)
      jest.advanceTimersByTime(61000);
      expect(service.getPhase(gameId)).toBe(GamePhase.ANSWERING);

      // 3. Проматываем время ответа (10 сек)
      jest.advanceTimersByTime(11000);
      expect(service.getPhase(gameId)).toBe(GamePhase.IDLE);
      expect(phaseChanges).toContain(GamePhase.IDLE);

      jest.useRealTimers();
    });

    it('should correctly pause and resume timer', async () => {
      jest.useFakeTimers();
      const gameId = 1;
      service['phase'].set(gameId, GamePhase.THINKING);
      service['remainingSeconds'].set(gameId, 30);

      await service.pauseTimer(gameId);
      jest.advanceTimersByTime(5000);
      expect(service['remainingSeconds'].get(gameId)).toBe(30); // Время не изменилось

      await service.resumeTimer(gameId);
      jest.advanceTimersByTime(1000);
      expect(service['remainingSeconds'].get(gameId)).toBe(29); // Время пошло снова

      jest.useRealTimers();
    });
  });

  describe('startNextQuestion (Game Flow)', () => {
    it('should start the next question based on database structure', async () => {
      const gameId = 1;
      service['activeQuestionIds'].set(gameId, 101); // Текущий вопрос

      mockGameRepository.getGameStructure.mockResolvedValue({
        rounds: [
          {
            round_number: 1,
            questions: [
              { id: 101, question_number: 1 },
              { id: 102, question_number: 2 },
            ],
          },
        ],
      });

      const nextId = await service.startNextQuestion(gameId, jest.fn());
      expect(nextId).toBe(102);
      expect(repository.activateQuestion).toHaveBeenCalledWith(gameId, 102);
    });
  });

  describe('processAnswer', () => {
    it('should save answer when question is active', async () => {
      const gameId = 1;
      service['activeQuestionIds'].set(gameId, 101);

      await service.processAnswer(gameId, 5, 'My answer');
      expect(repository.saveAnswer).toHaveBeenCalledWith(5, 101, 'My answer');
    });

    it('should return null if no active question exists', async () => {
      const result = await service.processAnswer(1, 5, 'Ghost answer');
      expect(result).toBeNull();
    });
  });
});
