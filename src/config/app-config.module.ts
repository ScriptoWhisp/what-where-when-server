import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'

/**
 * Single source of truth for environment configuration.
 *
 * Why this exists:
 * - Avoid "read process.env at import time" bugs (especially in tests)
 * - Centralize .env loading for local dev
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // In production you'd usually rely on real env vars. For local dev this
      // keeps behavior predictable.
      envFilePath: ['.env'],
    }),
  ],
})
export class AppConfigModule {}
