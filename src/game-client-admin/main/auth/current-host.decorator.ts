import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { HostJwtPayload } from './jwt.strategy';

type RequestWithHost = Request & { user?: HostJwtPayload };

export const CurrentHost = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): HostJwtPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithHost>();
    return request.user;
  },
);
