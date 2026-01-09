import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  AuthUserModel,
  UserRepository,
} from '../src/repository/user.repository';
import {
  HostGameDetails,
  SaveGameRequest,
} from '../src/repository/contracts/game.dto';
import { HostModule } from '../src/game-client-admin/main/host.module';
import { GameRepository } from '../src/repository/game.repository';
import { HostRoles } from '../src/repository/contracts/auth.dto';
import { GameStatuses } from '../src/repository/contracts/common.dto';


type CreateUserParams = {
  email: string;
  passwordHash: string;
  roleName: string;
};

class FakeUserRepo {
  private seq = 1;
  private usersByEmail = new Map<string, AuthUserModel>();

  async findByEmail(email: string): Promise<AuthUserModel | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async createUser(params: CreateUserParams): Promise<AuthUserModel> {
    const user: AuthUserModel = {
      id: this.seq++,
      email: params.email,
      password: params.passwordHash,
      role: params.roleName as any,
      createdAt: new Date(),
    };
    this.usersByEmail.set(user.email, user);
    return user;
  }
}

class FakeGameRepo {
  private seq = 1;
  private games = new Map<number, HostGameDetails>();

  async listHostGames(params: {
    hostId: number;
    limit: number;
    offset: number;
  }) {
    const all = [...this.games.values()].filter(
      (g) => g && params.hostId === (g as any).__hostId,
    );
    const slice = all.slice(params.offset, params.offset + params.limit);
    return {
      items: slice.map((g) => ({
        id: g.id,
        title: g.title,
        subtitle: g.date_of_event,
      })),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total: all.length,
      },
    };
  }

  async findByPasscode(passcode: number) {
    for (const g of this.games.values()) {
      if (Number(g.passcode) === passcode) return { id: g.id } as any;
    }
    return null;
  }

  async createGame(params: {
    hostId: number;
    name: string;
    date: Date;
    passcode: number;
    status: string;
  }) {
    const id = this.seq++;
    const now = new Date();
    const details: HostGameDetails = {
      id,
      title: params.name,
      date_of_event: params.date.toISOString(),
      status: params.status as any,
      passcode: String(params.passcode),
      settings: {
        time_to_think_sec: 60,
        time_to_answer_sec: 10,
        time_to_dispute_end_min: 10,
        show_leaderboard: true,
        show_questions: false,
        show_answers: false,
        can_appeal: true,
      },
      categories: [],
      teams: [],
      rounds: [],
      updated_at: now.toISOString(),
      version: 1,
    };
    // store hostId in a non-API field for filtering
    (details as any).__hostId = params.hostId;
    this.games.set(id, details);
    return { id } as any;
  }

  async getHostGameDetails(params: { hostId: number; gameId: number }) {
    const g = this.games.get(params.gameId);
    if (!g) return null;
    if ((g as any).__hostId !== params.hostId) return null;
    return g;
  }

  async saveHostGame(params: {
    hostId: number;
    req: SaveGameRequest;
  }): Promise<HostGameDetails> {
    const existing = await this.getHostGameDetails({
      hostId: params.hostId,
      gameId: params.req.game_id,
    });
    if (!existing) throw new Error('not found');
    // naive optimistic lock
    if (existing.version !== params.req.version)
      throw new Error('version conflict');

    const updated: HostGameDetails = {
      ...existing,
      title: params.req.game.title,
      date_of_event: params.req.game.date_of_event,
      settings: params.req.game.settings,
      rounds: params.req.game.rounds,
      categories: params.req.game.categories ?? [],
      teams: params.req.game.teams ?? [],
      passcode: existing.passcode,
      status: existing.status ?? GameStatuses.DRAFT,
      updated_at: new Date().toISOString(),
      version: existing.version + 1,
    };
    (updated as any).__hostId = (existing as any).__hostId;
    this.games.set(existing.id, updated);
    return updated;
  }
}

describe('HostController (component)', () => {
  let app: INestApplication;
  let userRepo: FakeUserRepo;
  let gameRepo: FakeGameRepo;

  beforeAll(async () => {
    userRepo = new FakeUserRepo();
    gameRepo = new FakeGameRepo();

    const moduleRef = await Test.createTestingModule({
      imports: [HostModule],
    })
      .overrideProvider(UserRepository)
      .useValue(userRepo)
      .overrideProvider(GameRepository)
      .useValue(gameRepo)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register -> login -> create game -> list games -> get game -> save game', async () => {
    const email = 'host@example.com';
    const password = 'pass1234';

    const registerRes = await request(app.getHttpServer())
      .post('/host/register')
      .send({ email, password })
      .expect(201);

    expect(registerRes.body.user.email).toBe(email);
    expect(registerRes.body.user.role).toBe(HostRoles.HOST);
    expect(registerRes.body.session.access_token).toBeTruthy();

    console.log('JWT_SECRET in sign:', process.env.JWT_SECRET);

    const loginRes = await request(app.getHttpServer())
      .post('/host/login')
      .send({ email, password })
      .expect(201);

    const token: string = loginRes.body.session.access_token;
    expect(token).toBeTruthy();

    console.log('LOGIN BODY:', loginRes.body);
    console.log('TOKEN:', token);

    const decoded = require('jsonwebtoken').decode(token, { complete: true });
    console.log('DECODED:', decoded);

    const createRes = await request(app.getHttpServer())
      .post('/host/games/create')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Game A', date_of_event: '2027-01-08' })
      .expect(201);

    const gameId = createRes.body.game.id;
    expect(gameId).toBeGreaterThan(0);
    console.log('GAME ID:', gameId);

    const listRes = await request(app.getHttpServer())
      .post('/host/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ limit: 50, offset: 0 })
      .expect(201);

    expect(listRes.body.items.length).toBe(1);
    expect(listRes.body.items[0].title).toBe('Game A');

    const getRes = await request(app.getHttpServer())
      .post('/host/game/get')
      .set('Authorization', `Bearer ${token}`)
      .send({ game_id: gameId })
      .expect(201);

    expect(getRes.body.game.id).toBe(gameId);

    const saveReq: SaveGameRequest = {
      game_id: gameId,
      version: getRes.body.game.version,
      game: {
        title: 'Game A (edited)',
        date_of_event: getRes.body.game.date_of_event,
        settings: getRes.body.game.settings,
        categories: [],
        teams: [],
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
    expect(saveRes.body.game.rounds.length).toBe(1);
    expect(saveRes.body.game.rounds[0].questions.length).toBe(1);
  });
});
