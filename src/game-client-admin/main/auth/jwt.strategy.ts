import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import process from 'node:process';
import * as passportJwt from 'passport-jwt';
import type { HostRole } from '../../dto/auth.dto';

export interface HostJwtPayload {
  sub: number;
  email: string;
  role: HostRole;
}

@Injectable()
export class HostJwtStrategy extends PassportStrategy(passportJwt.Strategy, 'host-jwt') {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const options: passportJwt.StrategyOptions = {
      jwtFromRequest: passportJwt.ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    };

    super(options);
  }

  validate(payload: HostJwtPayload): HostJwtPayload {
    return payload;
  }
}
