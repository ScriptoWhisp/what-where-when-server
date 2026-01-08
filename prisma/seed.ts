import { PrismaClient } from '@prisma/client';
import { HostRoles } from '../src/repository/contracts/auth.dto';

const prisma = new PrismaClient();

async function main() {
  await prisma.role.createMany({
    data: [
      { name: HostRoles.HOST },
      { name: HostRoles.ADMIN },
      { name: HostRoles.SCORER },
    ],
    skipDuplicates: true,
  });

  await prisma.answerStatus.createMany({
    data: [
      { name: 'UNSET' },
      { name: 'CORRECT' },
      { name: 'INCORRECT' },
      { name: 'DISPUTABLE' },
    ],
    skipDuplicates: true,
  });

  await prisma.disputeStatus.createMany({
    data: [{ name: 'OPEN' }, { name: 'REVIEWING' }, { name: 'RESOLVED' }],
    skipDuplicates: true,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
