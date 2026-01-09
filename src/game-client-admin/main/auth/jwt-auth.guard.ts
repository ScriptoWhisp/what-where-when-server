import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class HostJwtAuthGuard extends AuthGuard('host-jwt') {
  handleRequest(err: any, user: any, info: any, ctx: any) {
    if (err || !user) {
      const req = ctx.switchToHttp().getRequest();
      // eslint-disable-next-line no-console
      console.log('AUTH FAIL', {
        err: err?.message ?? err,
        info: info?.message ?? info,
        authHeader: req.headers?.authorization,
      });
    }
    return super.handleRequest(err, user, info, ctx);
  }
}
