import { WsJwtGuard } from './ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;
  let jwtService: JwtService;

  const createMockContext = (tokenInAuth?: string, authHeader?: string) => {
    const client = {
      handshake: {
        auth: {
          token: tokenInAuth,
        },
        headers: {
          authorization: authHeader,
        },
      },
    };

    return {
      switchToWs: () => ({
        getClient: () => client,
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    } as unknown as JwtService;

    guard = new WsJwtGuard(jwtService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true and attach user if token is provided in handshake.auth', async () => {
      const context = createMockContext('valid-token');
      const mockPayload = { sub: 1, email: 'admin@test.com' };

      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');

      const client = context.switchToWs().getClient();
      expect(client['user']).toEqual(mockPayload);
    });

    it('should return true if token is provided in Authorization header', async () => {
      const context = createMockContext(undefined, 'Bearer header-token');
      const mockPayload = { sub: 1 };

      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('header-token');
    });

    it('should throw WsException if token is missing entirely', async () => {
      const context = createMockContext(undefined, undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(WsException);
      await expect(guard.canActivate(context)).rejects.toThrow('Missing token');
    });

    it('should throw WsException if token is invalid', async () => {
      const context = createMockContext('invalid-token');

      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error('Invalid signature'),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(WsException);
      await expect(guard.canActivate(context)).rejects.toThrow('Unauthorized');
    });
  });
});
