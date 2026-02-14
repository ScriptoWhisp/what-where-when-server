import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../../config/app-config.module';
import { PrismaService } from './prisma.service';
import { PasscodeService } from '../passcode.service';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [PrismaService, PasscodeService],
  exports: [PrismaService, PasscodeService],
})
export class PrismaModule {}
