import { SetMetadata } from '@nestjs/common';
import { HostRole } from './auth.dto';

export const ROLES_KEY = 'host_required_roles';

/**
 * Restricts a controller method (or whole controller) to host users that have
 * one of the listed roles. Must be combined with HostJwtAuthGuard.
 */
export const Roles = (...roles: HostRole[]) => SetMetadata(ROLES_KEY, roles);
