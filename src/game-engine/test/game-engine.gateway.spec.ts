import { Test, TestingModule } from '@nestjs/testing';
import {
  GameEngineGateway,
  GameBroadcastEvent,
} from '../game-engine.gateway';
import { GameEngineService } from '../game-engine.service';
import { GameRepository } from '../../repository/game.repository';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { WsJwtGuard } from '../guards/ws-jwt.guard';

describe('GameEngineGateway', () => {
  let gateway: GameEngineGateway;
  let service: GameEngineService;

  const mockService = {
    validateHost: jest.fn(),
    startNextQuestion: jest.fn(),
    getGameState: jest.fn(),
    startGame: jest.fn(),
  };

  const mockRepo = {
    getAnswersByGame: jest.fn(),
    setParticipantDisconnected: jest.fn(),
  };

  const mockSocket = {
    id: 'socket-id',
    emit: jest.fn(),
    join: jest.fn(),
    to: jest.fn().mockReturnThis(),
    user: { sub: 1 },
  } as unknown as Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameEngineGateway,
        WsJwtGuard,
        { provide: GameEngineService, useValue: mockService },
        { provide: GameRepository, useValue: mockRepo },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<GameEngineGateway>(GameEngineGateway);
    service = module.get<GameEngineService>(GameEngineService);
    gateway.server = { to: jest.fn().mockReturnThis(), emit: jest.fn() } as any;
  });

  describe('handleNextQuestion', () => {
    it('should throw error if user is not the host', async () => {
      mockService.validateHost.mockResolvedValue(false);

      await expect(
        gateway.handleNextQuestion(mockSocket, { gameId: 1 }),
      ).rejects.toThrow('Forbidden');
    });

    it('should call service startNextQuestion if user is admin', async () => {
      mockService.validateHost.mockResolvedValue(true);

      await gateway.handleNextQuestion(mockSocket, { gameId: 1 });

      expect(service.startNextQuestion).toHaveBeenCalledWith(
        1,
        expect.any(Function),
      );
    });
  });

  describe('handleAdminSync', () => {
    it('should join rooms and emit full state', async () => {
      mockService.validateHost.mockResolvedValue(true);
      mockRepo.getAnswersByGame.mockResolvedValue([]);
      mockService.getGameState.mockResolvedValue({ status: 'LIVE' });

      await gateway.handleAdminSync(mockSocket, { gameId: 1 });

      expect(mockSocket.join).toHaveBeenCalledWith('game_1_admins');
      expect(mockSocket.join).toHaveBeenCalledWith('game_1');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        GameBroadcastEvent.SyncState,
        expect.objectContaining({
          state: { status: 'LIVE' },
          answers: [],
        }),
      );
    });
  });
});
