import { HostAuthService } from './host-auth.service';
import type { JwtService } from '@nestjs/jwt';
import type { UserRepository } from '../../../repository/user.repository';
import { HostRoles } from '../dto/auth.dto';

describe('HostAuthService (unit)', () => {
  it('register: creates user and returns session', async () => {
    const users: Partial<UserRepository> = {
      findByEmail: jest.fn(async () => null),
      createUser: jest.fn(async () => ({
        id: 1,
        email: 'host@example.com',
        password: 'hash',
        role: HostRoles.HOST,
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
    expect(res.user.role).toBe(HostRoles.HOST);
  });

  it('login: throws for unknown user', async () => {
    const users: Partial<UserRepository> = {
      findByEmail: jest.fn(async () => null),
    };

    const jwt: Partial<JwtService> = { sign: jest.fn() };
    const svc = new HostAuthService(users as UserRepository, jwt as JwtService);

    await expect(
      svc.login('nope@example.com', 'pass1234'),
    ).rejects.toHaveProperty('status', 401);
  });
});
