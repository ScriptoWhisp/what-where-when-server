import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import * as passportJwt from 'passport-jwt';
import type { HostRole } from '../dto/auth.dto';
import { ExtractJwt } from 'passport-jwt';

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
    const options: passportJwt.StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    };
    super(options);
  }

  validate(payload: HostJwtPayload): HostJwtPayload {
    return payload;
  }
}
