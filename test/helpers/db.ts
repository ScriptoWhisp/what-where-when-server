import type { PrismaService } from '../../src/repository/prisma/prisma.service';

export async function resetDb(prisma: PrismaService): Promise<void> {
  const tables = (
    await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname='public'`,
    )
  )
    .map((r) => r.tablename)
    .filter((t) => t !== '_prisma_migrations');

  if (tables.length === 0) return;

  const quoted = tables.map((t) => `"public"."${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
}
