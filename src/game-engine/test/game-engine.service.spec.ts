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

  describe('startNextQuestion', () => {
    it('should start the first question if no question is active', async () => {
      const gameId = 1;
      const onTick = jest.fn();
      mockGameRepository.getGameStructure.mockResolvedValue({
        rounds: [
          { round_number: 1, questions: [{ id: 101, question_number: 1 }] },
        ],
      });

      const nextId = await service.startNextQuestion(gameId, onTick);

      expect(nextId).toBe(101);
      expect(repository.activateQuestion).toHaveBeenCalledWith(gameId, 101);
    });

    it('should find the next question in the sequence', async () => {
      const gameId = 1;
      const onTick = jest.fn();
      service['activeQuestionIds'].set(gameId, 101);

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

      const nextId = await service.startNextQuestion(gameId, onTick);
      expect(nextId).toBe(102);
    });

    it('should return null if there are no more questions', async () => {
      const gameId = 1;
      service['activeQuestionIds'].set(gameId, 102);
      mockGameRepository.getGameStructure.mockResolvedValue({
        rounds: [
          { round_number: 1, questions: [{ id: 102, question_number: 1 }] },
        ],
      });

      const nextId = await service.startNextQuestion(gameId, jest.fn());
      expect(nextId).toBeNull();
    });
  });

  describe('Timer Logic', () => {
    it('should correctly transition through phases (THINKING -> ANSWERING -> IDLE)', (done) => {
      jest.useFakeTimers();
      const gameId = 1;
      const questionId = 101;

      service.startQuestionCycle(gameId, questionId, jest.fn(), (phase) => {
        if (phase === GamePhase.IDLE) {
          expect(service.getPhase(gameId)).toBe(GamePhase.IDLE);
          done();
        }
      });

      // THINKING (60s)
      expect(service.getPhase(gameId)).toBe(GamePhase.THINKING);
      jest.advanceTimersByTime(61000);

      // ANSWERING (10s)
      expect(service.getPhase(gameId)).toBe(GamePhase.ANSWERING);
      jest.advanceTimersByTime(11000);

      jest.useRealTimers();
    });

    it('should pause and resume the timer', () => {
      jest.useFakeTimers();
      const gameId = 1;
      service['phase'].set(gameId, GamePhase.THINKING);
      service['remainingSeconds'].set(gameId, 30);

      service.pauseTimer(gameId);
      jest.advanceTimersByTime(5000);
      expect(service['remainingSeconds'].get(gameId)).toBe(30);

      service.resumeTimer(gameId);
      jest.advanceTimersByTime(1000);
      expect(service['remainingSeconds'].get(gameId)).toBe(29);

      jest.useRealTimers();
    });
  });

  describe('processAnswer', () => {
    it('should save answer if a question is active', async () => {
      const gameId = 1;
      service['activeQuestionIds'].set(gameId, 101);

      await service.processAnswer(gameId, 5, 'My answer');
      expect(repository.saveAnswer).toHaveBeenCalledWith(5, 101, 'My answer');
    });

    it('should return null if no question is active', async () => {
      const result = await service.processAnswer(1, 5, 'My answer');
      expect(result).toBeNull();
      expect(repository.saveAnswer).not.toHaveBeenCalled();
    });
  });
});
