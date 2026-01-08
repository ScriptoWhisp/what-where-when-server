import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './repository/prisma/prisma.module';
import { HostModule } from './game-client-admin/host.module';

@Module({
  imports: [PrismaModule, HostModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
