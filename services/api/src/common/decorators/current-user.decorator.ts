import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
  companyId?: string;
}

/**
 * Extract the authenticated user from the request.
 *
 * @example
 * @Get('me')
 * getMe(@CurrentUser() user: AuthUser) { return user; }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
