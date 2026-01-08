import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HostController } from './controller/host.controller';
import { HostService } from './main/host.service';
import { HostAuthService } from './main/auth/host-auth.service';
import { HostJwtStrategy } from './main/auth/jwt.strategy';
import { UserRepository } from '../repository/user.repository';
import { GameRepository } from '../repository/game.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev_secret_change_me',
      signOptions: { expiresIn: 12 * 60 * 60 },
    }),
  ],
  controllers: [HostController],
  providers: [
    HostService,
    HostAuthService,
    HostJwtStrategy,
    UserRepository,
    GameRepository,
  ],
  exports: [HostService],
})
export class HostModule {}
