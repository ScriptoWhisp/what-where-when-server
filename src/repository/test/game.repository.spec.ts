import { Test, TestingModule } from '@nestjs/testing';
import { GameRepository } from '../game.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('GameRepository', () => {
  let repository: GameRepository;

  const mockPrisma = {
    answer: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      upsert: jest.fn(),
    },
    game: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    answerStatus: {
      findFirst: jest.fn(),
    },
    gameParticipant: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: typeof mockPrisma) => unknown) =>
      cb(mockPrisma),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<GameRepository>(GameRepository);
  });

  describe('getLeaderboard', () => {
    // TODO: write meaningful test
  });

  describe('saveAnswer', () => {
    it('creates a new answer when none exists', async () => {
      mockPrisma.answerStatus.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.answer.findUnique.mockResolvedValue(null);
      const mockSavedAnswer = {
        id: 99,
        questionId: 52,
        gameParticipantId: 18,
        answerText: 'test',
        submittedAt: new Date(),
        status: { name: 'UNSET' },
        participant: { team: { name: 'Team X' } },
      };
      mockPrisma.answer.create.mockResolvedValue(mockSavedAnswer);

      const result = await repository.saveAnswer(18, 52, 'test', new Date());

      expect(result.teamName).toBe('Team X');
      expect(result.id).toBe(99);
      expect(mockPrisma.answer.create).toHaveBeenCalled();
    });

    it('preserves a judged status when player resubmits', async () => {
      mockPrisma.answerStatus.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 99,
        statusId: 2, // 2 != 1 (UNSET) -> already judged
      });
      const mockUpdated = {
        id: 99,
        questionId: 52,
        gameParticipantId: 18,
        answerText: 'updated',
        submittedAt: new Date(),
        status: { name: 'CORRECT' },
        participant: { team: { name: 'Team X' } },
      };
      mockPrisma.answer.update.mockResolvedValue(mockUpdated);

      const result = await repository.saveAnswer(18, 52, 'updated', new Date());

      expect(result.id).toBe(99);
      const updateArgs = mockPrisma.answer.update.mock.calls[0][0];
      expect(updateArgs.data.statusId).toBeUndefined();
    });

    it('refreshes UNSET status on resubmit', async () => {
      mockPrisma.answerStatus.findFirst.mockResolvedValue({ id: 1 });
      mockPrisma.answer.findUnique.mockResolvedValue({
        id: 99,
        statusId: 1, // currently UNSET
      });
      const mockUpdated = {
        id: 99,
        questionId: 52,
        gameParticipantId: 18,
        answerText: 'updated',
        submittedAt: new Date(),
        status: { name: 'UNSET' },
        participant: { team: { name: 'Team X' } },
      };
      mockPrisma.answer.update.mockResolvedValue(mockUpdated);

      await repository.saveAnswer(18, 52, 'updated', new Date());

      const updateArgs = mockPrisma.answer.update.mock.calls[0][0];
      expect(updateArgs.data.statusId).toBe(1);
    });
  });
});
