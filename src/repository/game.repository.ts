import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Game } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';
import {
  gameDetailsInclude,
  HostGameCard,
  HostGameDetails,
  HostGamesListResponse,
  SaveGameRequest,
} from './contracts/game.dto';
import {
  mapHostGameCard,
  mapHostGameDetails,
  PlayerMapper,
} from './mappers/host-game.mapper';
import {
  gameVersion,
  parseDateOfEvent,
} from './utils/game.util';
import { GameStatuses } from './contracts/common.dto';
import { CheckGameResponse } from '../game-client-player/main/player.controller';
import { ParticipantDomain } from './contracts/game-engine.dto';
import { GameSaveDelegate } from './game-save.delegate';
import { PasscodeService } from './passcode.service';

@Injectable()
export class GameRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passcodeService: PasscodeService,
  ) {}

  async findGameByPasscodeWithTeams(
    passcode: number,
  ): Promise<CheckGameResponse | null> {
    const game = await this.prisma.game.findFirst({
      where: {
        passcode,
        status: { not: GameStatuses.FINISHED },
      },
      include: {
        participants: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!game) return null; // Add client error later

    return {
      gameId: game.id,
      gameName: game.name,
      teams: game.participants.map((p) => ({
        teamId: p.teamId,
        name: p.team.name,
        isAvailable: p.isAvailable,
      })),
    };
  }

  async teamJoinGame(
    gameId: number,
    teamId: number,
    socketId: string,
  ): Promise<ParticipantDomain> {
    const rawResult = await this.prisma.gameParticipant.update({
      where: {
        gameId_teamId: { gameId, teamId },
      },
      data: {
        isAvailable: false,
        socketId: socketId,
      },
      include: {
        team: true,
      },
    });

    return PlayerMapper.toParticipantDomain(rawResult);
  }

  async setParticipantDisconnected(socketId: string): Promise<void> {
    await this.prisma.gameParticipant.updateMany({
      where: { socketId },
      data: { isAvailable: true, socketId: null },
    });
  }

  async listHostGames(params: {
    hostId: number;
    limit: number;
    offset: number;
  }): Promise<HostGamesListResponse> {
    const where: Prisma.GameWhereInput = { hostId: params.hostId };

    const total = await this.prisma.game.count({ where });
    const games = await this.prisma.game.findMany({
      where,
      orderBy: { modifiedAt: 'desc' },
      take: params.limit,
      skip: params.offset,
      select: { id: true, name: true, date: true },
    });

    const items: HostGameCard[] = games.map(mapHostGameCard);

    return {
      items,
      pagination: { limit: params.limit, offset: params.offset, total },
    };
  }

  async createGameWithAutoPasscode(params: {
    hostId: number;
    name: string;
    date: Date;
    status: string;
  }): Promise<Game> {
    return this.prisma.$transaction(async (tx) => {
      const passcode = await this.passcodeService.allocateAvailablePasscode(tx);
      const game = await tx.game.create({
        data: {
          hostId: params.hostId,
          name: params.name,
          date: params.date,
          passcode,
          status: params.status,
          modifiedAt: new Date(),
        },
      });

      const ownedCategories = await tx.category.findMany({
        where: { userId: params.hostId },
      });
      for (const category of ownedCategories) {
        await tx.categoryGameRelation.upsert({
          where: {
            categoryId_gameId: { categoryId: category.id, gameId: game.id },
          },
          create: { categoryId: category.id, gameId: game.id },
          update: {},
        });
      }

      const ownedTeams = await tx.team.findMany({
        where: { managerId: params.hostId },
      });
      for (const team of ownedTeams) {
        await tx.gameParticipant.create({
          data: {
            gameId: game.id,
            teamId: team.id,
            categoryId: ownedCategories[0].id,
            isAvailable: true,
          },
        });
      }

      return game;
    });
  }

  async findByPasscode(passcode: number): Promise<Game | null> {
    return this.prisma.game.findFirst({
      where: { passcode, status: { not: GameStatuses.FINISHED } },
    });
  }

  async findById(id: number): Promise<Game | null> {
    return this.prisma.game.findUnique({ where: { id } });
  }

  async getHostGameDetails(params: {
    hostId: number;
    gameId: number;
  }): Promise<HostGameDetails | null> {
    const row = await this.prisma.game.findFirst({
      where: { id: params.gameId, hostId: params.hostId },
      include: gameDetailsInclude,
    });
    return row ? mapHostGameDetails(row) : null;
  }

  async saveHostGame(params: {
    hostId: number;
    req: SaveGameRequest;
  }): Promise<HostGameDetails> {
    const { hostId, req } = params;

    const full = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.game.findFirst({
        where: { id: req.game_id, hostId },
      });
      if (!existing) throw new NotFoundException('Game not found');

      const currentVersion = gameVersion(existing);
      if (currentVersion !== req.version)
        throw new ConflictException('Version conflict');

      const saver = new GameSaveDelegate(tx);

      await tx.game.update({
        where: { id: existing.id },
        data: {
          name: req.game.title,
          date: parseDateOfEvent(req.game.date_of_event),
          timeToThink: req.game.settings.time_to_think_sec,
          timeToAnswer: req.game.settings.time_to_answer_sec,
          timeToDisputeEnd: req.game.settings.time_to_dispute_end_min * 60,
          showLeaderboard: req.game.settings.show_leaderboard,
          showQuestions: req.game.settings.show_questions,
          showAnswer: req.game.settings.show_answers,
          canAppeal: req.game.settings.can_appeal,
          modifiedAt: new Date(),
        },
      });

      await saver.deleteEntities(existing.id, req);
      const categoryIds = await saver.syncCategories(
        hostId,
        existing.id,
        req.game.categories,
      );
      await saver.syncTeams(
        hostId,
        existing.id,
        req.game.teams,
        categoryIds[0],
      );
      await saver.syncRounds(existing.id, req.game.rounds);

      const updated = await tx.game.findFirst({
        where: { id: existing.id, hostId },
        include: gameDetailsInclude,
      });
      return updated!;
    });

    return mapHostGameDetails(full);
  }

  private async getStatusIdOrThrow(name: string): Promise<number> {
    const status = await this.prisma.answerStatus.findFirst({
      where: { name },
    });

    if (!status) {
      throw new Error(
        `Critical Error: Status "${name}" not found in database. Did you run the seed?`,
      );
    }

    return status.id;
  }

  async activateQuestion(gameId: number, questionId: number) {
    return this.prisma.$transaction([
      this.prisma.question.updateMany({
        where: { round: { gameId } },
        data: { isActive: false },
      }),
      this.prisma.question.update({
        where: { id: questionId },
        data: { isActive: true },
      }),
    ]);
  }

  async saveAnswer(participantId: number, questionId: number, text: string) {
    const statusId = await this.getStatusIdOrThrow('UNSET');
    return this.prisma.answer.create({
      data: {
        gameParticipantId: participantId,
        questionId: questionId,
        answerText: text,
        submittedAt: new Date(),
        statusId: statusId,
      },
    });
  }

  async getAnswersByQuestion(questionId: number) {
    return this.prisma.answer.findMany({
      where: { questionId },
      include: { participant: { include: { team: true } } },
    });
  }

  async judgeAnswer(answerId: number, statusName: string, adminId: number) {
    const newStatusId = await this.getStatusIdOrThrow(statusName);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.answer.findUniqueOrThrow({
        where: { id: answerId },
      });
      const updated = await tx.answer.update({
        where: { id: answerId },
        data: { statusId: newStatusId },
      });
      await tx.answerStatusHistory.create({
        data: {
          answerId: answerId,
          oldStatusId: current.statusId,
          newStatusId: newStatusId,
          changedById: adminId,
        },
      });
      return updated;
    });
  }

  async createDispute(answerId: number, comment: string) {
    const disputableStatusId = await this.getStatusIdOrThrow('DISPUTABLE');
    const openStatus = await this.prisma.disputeStatus.findFirst({
      where: { name: 'OPEN' },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.answer.update({
        where: { id: Number(answerId) },
        data: { statusId: disputableStatusId },
      });

      return tx.dispute.create({
        data: {
          answerId: Number(answerId),
          statusId: openStatus!.id,
          comment: comment,
        },
      });
    });
  }

  async getLeaderboard(gameId: number) {
    const correctStatusId = await this.getStatusIdOrThrow('CORRECT');
    const scores = await this.prisma.answer.groupBy({
      by: ['gameParticipantId'],
      where: {
        statusId: correctStatusId,
        participant: { gameId },
      },
      _count: { id: true },
    });

    const participants = await this.prisma.gameParticipant.findMany({
      where: { gameId },
      include: { team: true },
    });

    return participants
      .map((p) => ({
        participantId: p.id,
        teamName: p.team.name,
        score: scores.find((s) => s.gameParticipantId === p.id)?._count.id || 0,
      }))
      .sort((a, b) => b.score - a.score);
  }
}
