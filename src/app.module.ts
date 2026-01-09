import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './repository/prisma/prisma.module';
import { HostModule } from './game-client-admin/main/host.module';

@Module({
  imports: [AppConfigModule, PrismaModule, HostModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
