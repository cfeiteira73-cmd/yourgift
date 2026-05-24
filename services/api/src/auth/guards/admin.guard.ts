import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * AdminGuard — requires authenticated user to have role === 'admin'.
 * Must be used AFTER JwtAuthGuard so request.user is populated.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const user = request.user;
    if (!user || (user.role !== 'admin' && user.role !== 'ADMIN')) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
