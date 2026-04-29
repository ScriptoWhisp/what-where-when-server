import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';

const logger = new Logger('JwtConfig');

const DEV_FALLBACK_SECRET = 'dev_secret_change_me';

export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (secret && secret.length > 0) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET is not set. Refusing to start in production mode without a secret.',
    );
  }

  logger.warn(
    `JWT_SECRET is not set. Falling back to insecure dev value (${DEV_FALLBACK_SECRET}). DO NOT use this in production.`,
  );
  return DEV_FALLBACK_SECRET;
}

export function buildJwtModuleOptions(
  config: ConfigService,
): JwtModuleOptions {
  const expiresIn = parseExpiresIn(
    config.get<string>('JWT_EXPIRES_IN') ?? '12h',
  );
  return {
    secret: resolveJwtSecret(config),
    signOptions: { expiresIn },
  };
}

/**
 * Accepts either a number-of-seconds string ("43200") or an `ms`-style suffix
 * ("12h", "30m", "1d"). Returns seconds as a number to satisfy
 * JwtSignOptions['expiresIn'] without depending on the `ms` types.
 */
function parseExpiresIn(value: string): number {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(trimmed);
  if (match) {
    const n = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier =
      unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return n * multiplier;
  }

  return 12 * 3600;
}
