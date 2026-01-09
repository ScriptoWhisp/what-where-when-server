import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/repository/prisma/prisma.service';
import { resetDb } from './helpers/db';
import { beforeAll, expect, afterAll} from '@jest/globals';

describe('Host flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
    await app.close();
  });

  it('register -> create -> list -> get -> save', async () => {
    const email = `host_${Date.now()}@example.com`;
    const password = 'pass1234';

    const registerRes = await request(app.getHttpServer())
      .post('/host/register')
      .send({ email, password })
      .expect(201);

    const token: string = registerRes.body.session.access_token;
    expect(token).toBeTruthy();

    const createRes = await request(app.getHttpServer())
      .post('/host/games/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Game A', date_of_event: '2027-01-08' })
      .expect(201);

    const gameId: number = createRes.body.game.id;
    expect(gameId).toBeGreaterThan(0);

    const listRes = await request(app.getHttpServer())
      .post('/host/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ limit: 50, offset: 0 })
      .expect(201);

    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0].id).toBe(gameId);

    const getRes = await request(app.getHttpServer())
      .post('/host/game/get')
      .set('Authorization', `Bearer ${token}`)
      .query({ game_id: gameId })
      .expect(201);

    expect(getRes.body.game.id).toBe(gameId);

    const saveReq = {
      game_id: gameId,
      version: getRes.body.game.version,
      game: {
        ...getRes.body.game,
        title: 'Game A (edited)',
        rounds: [
          {
            round_number: 1,
            name: 'Round 1',
            questions: [
              {
                question_number: 1,
                text: '2+2?',
                answer: '4',
                time_to_think_sec: 60,
                time_to_answer_sec: 10,
              },
            ],
          },
        ],
      },
    };

    const saveRes = await request(app.getHttpServer())
      .post('/host/game/save')
      .set('Authorization', `Bearer ${token}`)
      .send(saveReq)
      .expect(201);

    expect(saveRes.body.game.title).toBe('Game A (edited)');
    expect(saveRes.body.game.rounds).toHaveLength(1);
    expect(saveRes.body.game.rounds[0].questions).toHaveLength(1);
  });
});
