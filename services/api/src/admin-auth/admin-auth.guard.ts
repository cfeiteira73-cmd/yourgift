import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AdminJwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  type: string;
}

/**
 * AdminAuthGuard — validates the admin JWT token issued by AdminAuthService.
 * Reads the Bearer token from the Authorization header and verifies it.
 * Populates request.user with the decoded payload.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AdminJwtPayload;
    }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    try {
      const payload = this.jwt.verify<AdminJwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      if (payload.type !== 'admin') {
        throw new UnauthorizedException('Not an admin token');
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }
  }
}
