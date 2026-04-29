import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HostRole } from './auth.dto';
import { ROLES_KEY } from './roles.decorator';
import type { HostJwtPayload } from './jwt.strategy';

@Injectable()
export class HostRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<HostRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles annotation: any authenticated host is allowed.
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: HostJwtPayload }>();
    const role = request.user?.role;

    if (!role || !required.includes(role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Insufficient role for this operation',
      });
    }
    return true;
  }
}
