import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { HostJwtPayload } from './jwt.strategy';

export const HostUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): HostJwtPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as HostJwtPayload;
  },
);
