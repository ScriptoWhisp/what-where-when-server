import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JudgingNotAllowedError } from '../errors/judging-not-allowed.error';

interface ClientErrorPayload {
  message: string;
  code?: string;
}

/**
 * Catches everything thrown from a @SubscribeMessage handler and turns it into
 * a single client-facing 'error' event. Internal exception messages are NEVER
 * forwarded to the client unless they are explicitly whitelisted (WsException
 * or domain errors that carry a stable `code`). This avoids leaking Prisma /
 * stack details over the wire.
 */
@Catch()
export class WsExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToWs();
    const client = ctx.getClient<Socket>();

    const payload = this.toClientPayload(exception);

    this.logger.error(
      `WS exception on event "${(ctx.getPattern && ctx.getPattern()) || 'unknown'}" for socket ${client?.id}: ${
        exception instanceof Error ? exception.stack || exception.message : String(exception)
      }`,
    );

    try {
      client?.emit('error', payload);
    } catch {
      // socket may already be closed; nothing more we can do
    }
  }

  private toClientPayload(exception: unknown): ClientErrorPayload {
    if (exception instanceof JudgingNotAllowedError) {
      return { message: exception.message, code: exception.code };
    }

    if (exception instanceof WsException) {
      const error = exception.getError();
      const message =
        typeof error === 'string'
          ? error
          : (error as { message?: string })?.message || 'Bad request';
      return { message };
    }

    return { message: 'Internal server error' };
  }
}
