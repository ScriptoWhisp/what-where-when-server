import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { HostController } from './controller/host.controller';
import { HostService } from './service/host.service';
import { HostAuthService } from './auth/host-auth.service';
import { HostJwtStrategy } from './auth/jwt.strategy';
import { UserRepository } from '../../repository/user.repository';
import { HostJwtAuthGuard } from './auth/jwt-auth.guard';
import { AppConfigModule } from '../../config/app-config.module';
import { HostGameRepository } from '../../repository/host.game.repository';

@Module({
  imports: [
    AppConfigModule,
    PassportModule.register({ defaultStrategy: 'host-jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev_secret_change_me',
        signOptions: { expiresIn: 12 * 60 * 60 },
      }),
    }),
  ],
  controllers: [HostController],
  providers: [
    HostService,
    HostAuthService,
    HostJwtStrategy,
    HostJwtAuthGuard,
    UserRepository,
    HostGameRepository,
  ],
  exports: [HostService],
})
export class HostModule {}
