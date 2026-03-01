import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import * as passportJwt from 'passport-jwt';
import { ExtractJwt } from 'passport-jwt';
import { HostRole } from './auth.dto';

export interface HostJwtPayload {
  sub: number;
  email: string;
  role: HostRole;
}

@Injectable()
export class HostJwtStrategy extends PassportStrategy(
  passportJwt.Strategy,
  'host-jwt',
) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET') ?? 'dev_secret_change_me';
    super({
      secretOrKey: secret,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
    });
  }

  validate(payload: HostJwtPayload): HostJwtPayload {
    return payload;
  }
}
