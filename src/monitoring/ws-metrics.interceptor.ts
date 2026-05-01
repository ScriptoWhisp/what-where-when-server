import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs';
import { wsHandlerDurationSeconds } from './metrics';

@Injectable()
export class WsMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http' | 'ws' | 'rpc'>() !== 'ws') {
      return next.handle();
    }

    const patternRaw = context.switchToWs().getPattern() as unknown;
    const eventLabel =
      typeof patternRaw === 'string'
        ? patternRaw
        : Array.isArray(patternRaw)
          ? patternRaw.filter((p: unknown): p is string => typeof p === 'string').join(',')
          : 'unknown';

    const endTimer = wsHandlerDurationSeconds.labels(eventLabel || 'unknown').startTimer();

    return next.handle().pipe(finalize(() => endTimer()));
  }
}
