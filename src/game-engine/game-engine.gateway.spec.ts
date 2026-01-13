import { Test, TestingModule } from '@nestjs/testing';
import { GameEngineGateway } from './game-engine.gateway';
import { GameEngineService } from './game-engine.service';
import { GameRepository } from '../repository/game.repository';

describe('GameEngineGateway', () => {
  let gateway: GameEngineGateway;

  const mockGameEngineService = {
    startTimer: jest.fn(),
    stopTimer: jest.fn(),
  };

  const mockGameRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameEngineGateway,
        { provide: GameEngineService, useValue: mockGameEngineService },
        { provide: GameRepository, useValue: mockGameRepository },
      ],
    }).compile();

    gateway = module.get<GameEngineGateway>(GameEngineGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
