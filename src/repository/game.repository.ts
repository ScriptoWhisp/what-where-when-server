import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Game } from '@prisma/client';
import { PrismaService } from './prisma/prisma.service';
import type {
  HostGameCard,
  HostGameDetails,
  HostGamesListResponse,
  SaveGameRequest,
} from './contracts/game.dto';
import {
  mapHostGameCard,
  mapHostGameDetails,
} from './mappers/host-game.mapper';
import { gameVersion, parseDateOfEvent } from './utils/game.util';

export const gameDetailsInclude = Prisma.validator<Prisma.GameInclude>()({
  rounds: {
    orderBy: { roundNumber: 'asc' },
    include: {
      questions: { orderBy: { questionNumber: 'asc' } },
    },
  },
  categoryLinks: { include: { category: true } },
  participants: { include: { team: true, category: true } },
});

@Injectable()
export class GameRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  async createGame(params: {
    hostId: number;
    name: string;
    date: Date;
    passcode: number;
    status: string;
  }): Promise<Game> {
    return this.prisma.game.create({
      data: {
        hostId: params.hostId,
        name: params.name,
        date: params.date,
        passcode: params.passcode,
        status: params.status,
        modifiedAt: new Date(),
      },
    });
  }

  async findByPasscode(passcode: number): Promise<Game | null> {
    return this.prisma.game.findFirst({ where: { passcode } });
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
      if (req.game.teams.length > 0 && req.game.categories.length === 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'At least one category is required when adding teams',
        });
      }

      const existing = await tx.game.findFirst({
        where: { id: req.game_id, hostId },
      });
      if (!existing) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Game not found',
        });
      }

      const currentVersion = gameVersion(existing);
      if (currentVersion !== req.version) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Version conflict. Reload game and retry save.',
          details: { current_version: currentVersion },
        });
      }

      const date = parseDateOfEvent(req.game.date_of_event);
      const nextPasscode = existing.passcode;
      if (Number.isNaN(nextPasscode)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid passcode',
        });
      }
      const passcodeOwner = await tx.game.findFirst({
        where: { passcode: nextPasscode },
      });
      if (passcodeOwner && passcodeOwner.id !== existing.id) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'passcode already exists',
        });
      }

      await tx.game.update({
        where: { id: existing.id },
        data: {
          name: req.game.title,
          date,
          passcode: nextPasscode,
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

      if (req.deleted_question_ids?.length) {
        await tx.question.deleteMany({
          where: {
            id: { in: req.deleted_question_ids },
            round: { gameId: existing.id },
          },
        });
      }

      if (req.deleted_round_ids?.length) {
        await tx.question.deleteMany({
          where: {
            roundId: { in: req.deleted_round_ids },
            round: { gameId: existing.id },
          },
        });
        await tx.round.deleteMany({
          where: { id: { in: req.deleted_round_ids }, gameId: existing.id },
        });
      }

      if (req.deleted_team_ids?.length) {
        await tx.gameParticipant.deleteMany({
          where: { gameId: existing.id, teamId: { in: req.deleted_team_ids } },
        });
      }

      if (req.deleted_category_ids?.length) {
        await tx.categoryGameRelation.deleteMany({
          where: {
            gameId: existing.id,
            categoryId: { in: req.deleted_category_ids },
          },
        });
      }

      const categoryIds: number[] = [];
      for (const c of req.game.categories) {
        let categoryId: number;
        if (c.id) {
          const owned = await tx.category.findFirst({
            where: { id: c.id, userId: hostId },
          });
          if (!owned) {
            throw new NotFoundException({
              code: 'NOT_FOUND',
              message: `Category not found: ${c.id}`,
            });
          }
          await tx.category.update({
            where: { id: c.id },
            data: { name: c.name, description: c.description ?? null },
          });
          categoryId = c.id;
        } else {
          const created = await tx.category.create({
            data: {
              userId: hostId,
              name: c.name,
              description: c.description ?? null,
            },
          });
          categoryId = created.id;
        }
        categoryIds.push(categoryId);

        await tx.categoryGameRelation.upsert({
          where: {
            categoryId_gameId: { categoryId, gameId: existing.id },
          },
          create: { categoryId, gameId: existing.id },
          update: {},
        });
      }

      const defaultCategoryId = categoryIds[0];

      if (req.game.teams.length > 0 && !defaultCategoryId) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message:
            'At least one category is required before adding teams to a game',
        });
      }

      for (const t of req.game.teams) {
        let teamId: number;
        if (t.id) {
          const ownedTeam = await tx.team.findFirst({ where: { id: t.id } });
          if (!ownedTeam) {
            throw new NotFoundException({
              code: 'NOT_FOUND',
              message: `Team not found: ${t.id}`,
            });
          }
          const updated = await tx.team.update({
            where: { id: t.id },
            data: { name: t.name, teamCode: t.team_code },
          });
          teamId = updated.id;
        } else {
          const created = await tx.team.create({
            data: { name: t.name, teamCode: t.team_code },
          });
          teamId = created.id;
        }

        if (defaultCategoryId) {
          const already = await tx.gameParticipant.findFirst({
            where: { gameId: existing.id, teamId },
          });
          if (!already) {
            await tx.gameParticipant.create({
              data: {
                gameId: existing.id,
                teamId,
                categoryId: defaultCategoryId,
                isAvailable: true,
              },
            });
          }
        }
      }

      for (const r of req.game.rounds) {
        let roundId: number;
        if (r.id) {
          const ownedRound = await tx.round.findFirst({
            where: { id: r.id, gameId: existing.id },
          });
          if (!ownedRound) {
            throw new NotFoundException({
              code: 'NOT_FOUND',
              message: `Round not found: ${r.id}`,
            });
          }
          const updated = await tx.round.update({
            where: { id: r.id },
            data: { roundNumber: r.round_number, name: r.name ?? null },
          });
          roundId = updated.id;
        } else {
          const created = await tx.round.create({
            data: {
              gameId: existing.id,
              roundNumber: r.round_number,
              name: r.name ?? null,
            },
          });
          roundId = created.id;
        }

        for (const q of r.questions) {
          if (q.id) {
            const ownedQuestion = await tx.question.findFirst({
              where: { id: q.id, round: { gameId: existing.id } },
            });
            if (!ownedQuestion) {
              throw new NotFoundException({
                code: 'NOT_FOUND',
                message: `Question not found: ${q.id}`,
              });
            }
            await tx.question.update({
              where: { id: q.id },
              data: {
                roundId,
                questionNumber: q.question_number,
                text: q.text,
                answer: q.answer,
                timeToThink: q.time_to_think_sec,
                timeToAnswer: q.time_to_answer_sec,
              },
            });
          } else {
            await tx.question.create({
              data: {
                roundId,
                questionNumber: q.question_number,
                text: q.text,
                answer: q.answer,
                timeToThink: q.time_to_think_sec,
                timeToAnswer: q.time_to_answer_sec,
                isActive: false,
              },
            });
          }
        }
      }

      const row = await tx.game.findFirst({
        where: { id: existing.id, hostId },
        include: gameDetailsInclude,
      });

      if (!row) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Game not found after save',
        });
      }

      return row;
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
