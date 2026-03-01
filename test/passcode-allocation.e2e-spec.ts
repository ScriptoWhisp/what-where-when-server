import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/repository/prisma/prisma.service';
import { resetDb } from './helpers/db';
import { GameStatus } from '../src/repository/contracts/game-engine.dto';

describe('Passcode allocation', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const originalRandom = Math.random;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await resetDb(prisma);
  });

  afterAll(async () => {
    Math.random = originalRandom;
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  async function registerAndGetToken(): Promise<string> {
    const email = `host_${Date.now()}@example.com`;
    const password = 'pass1234';

    const registerRes = await request(app.getHttpServer())
      .post('/host/register')
      .send({ email, password })
      .expect(201);

    const token: string = registerRes.body.session.access_token;
    expect(token).toBeTruthy();
    return token;
  }

  it('allocates unique passcodes across concurrent creates even if RNG always returns the same value', async () => {
    const token = await registerAndGetToken();

    Math.random = () => 0;

    const N = 8;

    const createRequests = Array.from({ length: N }, (_, i) =>
      request(app.getHttpServer())
        .post('/host/games/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Game ${i + 1}`, date_of_event: '2027-01-08' })
        .expect(201),
    );

    const results = await Promise.all(createRequests);

    const passcodes = results.map((r) => r.body.game.passcode as number);

    // Must be unique (this is what pg_advisory_xact_lock protects)
    expect(new Set(passcodes).size).toBe(N);

    // With deterministic fallback, we expect 1000..1000+N-1 in some order
    const sorted = [...passcodes].sort((a, b) => a - b).map(String);
    expect(sorted).toEqual(
      Array.from({ length: N }, (_, k) => 1000 + k).map(String),
    );
  });

  it('allows reusing passcode from FINISHED games (FINISHED is ignored in allocation)', async () => {
    const token = await registerAndGetToken();

    Math.random = () => 0;

    const first = await request(app.getHttpServer())
      .post('/host/games/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Game 1', date_of_event: '2027-01-08' })
      .expect(201);

    const gameId: number = first.body.game.id;
    const code1: number = first.body.game.passcode;

    expect(code1).toBe("1000");

    // Mark it as FINISHED directly in DB
    await prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.FINISHED },
    });

    // Now 1000 should be "free" again because FINISHED is ignored
    const second = await request(app.getHttpServer())
      .post('/host/games/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Game 2', date_of_event: '2027-01-08' })
      .expect(201);

    const code2: number = second.body.game.passcode;
    expect(code2).toBe("1000");
  });

  it('does NOT reuse passcodes from active games (DRAFT/LIVE)', async () => {
    const token = await registerAndGetToken();

    Math.random = () => 0;

    const a = await request(app.getHttpServer())
      .post('/host/games/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Game A', date_of_event: '2027-01-08' })
      .expect(201);

    const codeA: number = a.body.game.passcode;
    expect(codeA).toBe("1000");

    const b = await request(app.getHttpServer())
      .post('/host/games/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Game B', date_of_event: '2027-01-08' })
      .expect(201);

    const codeB: number = b.body.game.passcode;
    expect(codeB).toBe("1001");
  });
});
