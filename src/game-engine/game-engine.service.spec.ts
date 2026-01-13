import { Test, TestingModule } from '@nestjs/testing';
import { GameEngineService } from './game-engine.service';
import { GameRepository } from '../repository/game.repository';

describe('GameEngineService', () => {
  let service: GameEngineService;

  const mockGameRepository = {
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameEngineService,
        { provide: GameRepository, useValue: mockGameRepository },
      ],
    }).compile();

    service = module.get<GameEngineService>(GameEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should start and stop timer correctly', () => {
    jest.useFakeTimers();
    const tickSpy = jest.fn();
    const endSpy = jest.fn();

    // service.startTimer('test-game', 3, 'THINKING', tickSpy, endSpy);

    jest.advanceTimersByTime(4000);

    expect(tickSpy).toHaveBeenCalledTimes(4);
    expect(endSpy).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
