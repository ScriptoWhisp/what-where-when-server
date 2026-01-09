import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class HostJwtAuthGuard extends AuthGuard('host-jwt') {}
