import {
  CallHandler,
  ExecutionContext,
  Injectable,
  HttpException,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, finalize, throwError } from 'rxjs';
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  normalizeRoute,
} from './metrics';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http' | 'ws' | 'rpc'>() !== 'http') {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      route?: { path?: string };
    }>();
    const res = httpCtx.getResponse<{ statusCode?: number }>();

    const start = process.hrtime.bigint();
    let statusOverride: number | undefined = undefined;

    return next.handle().pipe(
      catchError((err) => {
        statusOverride =
          err instanceof HttpException ? err.getStatus() : 500;
        return throwError(() => err);
      }),
      finalize(() => {
        const end = process.hrtime.bigint();
        const seconds = Number(end - start) / 1e9;

        const method = (req?.method ?? 'UNKNOWN').toUpperCase();
        const status = String(statusOverride ?? res?.statusCode ?? 0);
        const route =
          normalizeRoute(req?.route?.path) ||
          normalizeRoute(req?.originalUrl) ||
          normalizeRoute(req?.url);

        httpRequestsTotal.labels(method, route, status).inc(1);
        httpRequestDurationSeconds.labels(method, route, status).observe(seconds);
      }),
    );
  }
}

