import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  UserRepository,
  type AuthUserModel,
} from '../../../repository/user.repository';
import {
  HostLoginResponse,
  type HostPassdropResponse,
  HostRegisterResponse,
  HostRoles,
} from '../dto/auth.dto';

const DEFAULT_TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12h

@Injectable()
export class HostAuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async register(
    email: string,
    password: string,
  ): Promise<HostRegisterResponse> {
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Email is already registered',
        details: { field: 'email' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users.createUser({
      email,
      passwordHash,
      roleName: HostRoles.HOST,
    });

    return this.issueSession(user);
  }

  async login(email: string, password: string): Promise<HostLoginResponse> {
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    return this.issueSession(user);
  }

  passdrop(email: string): HostPassdropResponse {
    void email;
    return {
      message: 'If the email exists, password reset instructions were sent.',
    };
  }

  private issueSession(user: AuthUserModel): HostRegisterResponse {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + DEFAULT_TOKEN_TTL_SECONDS;

    const access_token = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: DEFAULT_TOKEN_TTL_SECONDS },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.createdAt.toISOString(),
      },
      session: {
        access_token,
        expires_at: new Date(exp * 1000).toISOString(),
      },
    };
  }
}
