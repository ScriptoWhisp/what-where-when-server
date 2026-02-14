import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { SaveGameRequest } from './contracts/game.dto';

export class GameSaveDelegate {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async syncCategories(hostId: number, gameId: number, categories: any[]) {
    const categoryIds: number[] = [];
    for (const c of categories) {
      let categoryId: number;
      if (c.id) {
        const owned = await this.tx.category.findFirst({
          where: { id: c.id, userId: hostId },
        });
        if (!owned) throw new NotFoundException(`Category not found: ${c.id}`);
        await this.tx.category.update({
          where: { id: c.id },
          data: { name: c.name, description: c.description ?? null },
        });
        categoryId = c.id;
      } else {
        const created = await this.tx.category.create({
          data: {
            userId: hostId,
            name: c.name,
            description: c.description ?? null,
          },
        });
        categoryId = created.id;
      }
      categoryIds.push(categoryId);
      await this.tx.categoryGameRelation.upsert({
        where: { categoryId_gameId: { categoryId, gameId } },
        create: { categoryId, gameId },
        update: {},
      });
    }
    return categoryIds;
  }

  async syncTeams(
    hostId: number,
    gameId: number,
    teams: any[],
    defaultCategoryId?: number,
  ) {
    for (const t of teams) {
      let teamId: number;
      if (t.id) {
        const updated = await this.tx.team.update({
          where: { id: t.id },
          data: { name: t.name, teamCode: t.team_code },
        });
        teamId = updated.id;
      } else {
        const created = await this.tx.team.create({
          data: { name: t.name, teamCode: t.team_code, managerId: hostId },
        });
        teamId = created.id;
      }

      if (defaultCategoryId) {
        const already = await this.tx.gameParticipant.findFirst({
          where: { gameId, teamId },
        });
        if (!already) {
          await this.tx.gameParticipant.create({
            data: {
              gameId,
              teamId,
              categoryId: defaultCategoryId,
              isAvailable: true,
            },
          });
        }
      }
    }
  }

  async syncRounds(gameId: number, rounds: any[]) {
    for (const r of rounds) {
      let roundId: number;
      if (r.id) {
        const updated = await this.tx.round.update({
          where: { id: r.id },
          data: { roundNumber: r.round_number, name: r.name ?? null },
        });
        roundId = updated.id;
      } else {
        const created = await this.tx.round.create({
          data: { gameId, roundNumber: r.round_number, name: r.name ?? null },
        });
        roundId = created.id;
      }

      for (const q of r.questions) {
        if (q.id) {
          await this.tx.question.update({
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
          await this.tx.question.create({
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
  }

  async deleteEntities(gameId: number, req: SaveGameRequest) {
    if (req.deleted_question_ids?.length) {
      await this.tx.question.deleteMany({
        where: { id: { in: req.deleted_question_ids }, round: { gameId } },
      });
    }
    if (req.deleted_round_ids?.length) {
      await this.tx.question.deleteMany({
        where: { roundId: { in: req.deleted_round_ids }, round: { gameId } },
      });
      await this.tx.round.deleteMany({
        where: { id: { in: req.deleted_round_ids }, gameId },
      });
    }
    if (req.deleted_team_ids?.length) {
      await this.tx.gameParticipant.deleteMany({
        where: { gameId, teamId: { in: req.deleted_team_ids } },
      });
    }
    if (req.deleted_category_ids?.length) {
      await this.tx.categoryGameRelation.deleteMany({
        where: { gameId, categoryId: { in: req.deleted_category_ids } },
      });
    }
  }
}
