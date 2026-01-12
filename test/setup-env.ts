process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test_secret';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://www:www@localhost:5434/www_test?schema=public';
