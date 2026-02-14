import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';
import { generate4DigitPasscode } from './utils/game.util';
import { GameStatuses } from './contracts/common.dto';

const GAME_CODE_LOCK = 424242;

@Injectable()
export class PasscodeService {
  constructor(private readonly prisma: PrismaService) {}

  async allocateAvailablePasscode(
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GAME_CODE_LOCK})`;

    const activeStatuses = [GameStatuses.DRAFT, GameStatuses.LIVE];

    const rows = await tx.game.findMany({
      where: { status: { in: activeStatuses } },
      select: { passcode: true },
    });

    const used = new Set<number>(rows.map((r) => r.passcode));

    if (used.size >= 9000) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'No passcodes available',
      });
    }

    for (let i = 0; i < 64; i++) {
      const candidate = generate4DigitPasscode();
      if (!used.has(candidate)) return candidate;
    }

    for (let candidate = 1000; candidate <= 9999; candidate++) {
      if (!used.has(candidate)) return candidate;
    }

    throw new ConflictException({
      code: 'CONFLICT',
      message: 'No passcodes available',
    });
  }
}
