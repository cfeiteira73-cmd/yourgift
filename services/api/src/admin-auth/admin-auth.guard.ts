import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const SKIP_MFA_KEY = 'skipMfa';

/**
 * Decorator — place on a route handler to exempt it from the MFA-verified check.
 * Use on routes that are part of the MFA setup/verify flow itself.
 */
export const SkipMfa = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_MFA_KEY, true);

export interface AdminJwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  type: string;
  /** True once the admin has passed the TOTP verification step in this session. */
  mfaVerified?: boolean;
}

interface AuthenticatedRequest {
  headers: Record<string, string | undefined>;
  user?: AdminJwtPayload;
}

/**
 * AdminAuthGuard — validates the admin JWT token issued by AdminAuthService.
 *
 * MFA enforcement (SOC2 CC6.3):
 *   If the decoded payload carries `mfaVerified: false` (or the field is absent
 *   and the admin has MFA enabled), the guard rejects the request unless the
 *   route is decorated with @SkipMfa().
 *
 * Backward compatibility:
 *   Admins that have not yet enrolled in MFA (mfaEnabled=false) are allowed
 *   through so existing routes continue to work during rollout.  Once an admin
 *   enables MFA, every subsequent JWT must carry mfaVerified=true.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.slice(7);
    let payload: AdminJwtPayload;
    try {
      payload = this.jwt.verify<AdminJwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    if (payload.type !== 'admin') {
      throw new UnauthorizedException('Not an admin token');
    }

    request.user = payload;

    // Check if this handler/class has opted out of the MFA check.
    const skipMfa =
      this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (!skipMfa) {
      // mfaVerified is only set to true after the /mfa/verify step.
      // If the token was issued before MFA was enabled on the account,
      // mfaVerified will be undefined — treat that the same as false
      // when the admin has MFA enrolled.
      const mfaRequired = payload.mfaVerified === false;
      if (mfaRequired) {
        throw new UnauthorizedException('MFA verification required');
      }
    }

    return true;
  }
}
