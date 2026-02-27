import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { coerceHostRole } from './types/guards';
import { HostRole } from '../game-client-admin/main/auth/auth.dto';

export type AuthUserModel = {
  id: number;
  email: string;
  password: string;
  role: HostRole;
  createdAt: Date;
};

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<AuthUserModel | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      password: row.password,
      role: coerceHostRole(row.role?.name),
      createdAt: row.createdAt,
    };
  }

  async createUser(params: {
    email: string;
    passwordHash: string;
    roleName: HostRole;
  }): Promise<AuthUserModel> {
    const role = await this.prisma.role.findFirst({
      where: { name: params.roleName },
    });

    const roleId =
      role?.id ??
      (
        await this.prisma.role.create({
          data: { name: params.roleName },
        })
      ).id;

    const row = await this.prisma.user.create({
      data: {
        email: params.email,
        password: params.passwordHash,
        roleId,
      },
      include: { role: true },
    });

    return {
      id: row.id,
      email: row.email,
      password: row.password,
      role: coerceHostRole(row.role?.name),
      createdAt: row.createdAt,
    };
  }
}
