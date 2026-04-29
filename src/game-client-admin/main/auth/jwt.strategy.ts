import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import * as passportJwt from 'passport-jwt';
import { ExtractJwt } from 'passport-jwt';
import { HostRole } from './auth.dto';
import { resolveJwtSecret } from '../../../config/jwt.config';

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
    super({
      secretOrKey: resolveJwtSecret(config),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
    });
  }

  validate(payload: HostJwtPayload): HostJwtPayload {
    return payload;
  }
}
