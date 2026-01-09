// NOTE: This file runs BEFORE any test file imports (Jest "setupFiles").
// That matters because Nest module configuration often reads env vars at import/init time.

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test_secret';

// If you run tests against docker-compose.test.yml
// then DATABASE_URL below should match that container.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://www:www@localhost:5434/www_test?schema=public';
