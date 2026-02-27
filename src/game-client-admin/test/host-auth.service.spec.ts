import type { JwtService } from '@nestjs/jwt';
import { HostAuthService } from '../main/auth/host-auth.service';
import { UserRepository } from '../../repository/user.repository';
import { HostRole } from '../main/auth/auth.dto';

describe('HostAuthService (unit)', () => {
  it('register creates user and returns session', async () => {
    const users: Partial<UserRepository> = {
      findByEmail: jest.fn(async () => null),
      createUser: jest.fn(async () => ({
        id: 1,
        email: 'host@example.com',
        password: 'hash',
        role: HostRole.HOST,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })),
    };

    const jwt: Partial<JwtService> = {
      sign: jest.fn(() => 'token123'),
    };

    const svc = new HostAuthService(users as UserRepository, jwt as JwtService);
    const res = await svc.register('host@example.com', 'pass1234');

    expect(users.createUser).toHaveBeenCalled();
    expect(jwt.sign).toHaveBeenCalled();
    expect(res.session.access_token).toBe('token123');
  });
});
