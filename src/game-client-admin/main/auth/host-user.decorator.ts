import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { HostJwtPayload } from './jwt.strategy';

type HostRequest = Request & { user?: HostJwtPayload };

export const HostUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): HostJwtPayload => {
    const req = ctx.switchToHttp().getRequest<HostRequest>();

    if (!req.user) {
      throw new UnauthorizedException();
    }

    return req.user;
  },
);
