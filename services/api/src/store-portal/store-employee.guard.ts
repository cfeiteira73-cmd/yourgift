import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

export interface EmployeeJwtPayload {
  sub: string;
  email: string;
  name: string;
  storeId: string;
  slug: string;
  type: 'store_employee';
  iat?: number;
  exp?: number;
}

// Augment the Express Request type locally
export interface EmployeeRequest extends Request {
  employee: EmployeeJwtPayload;
}

@Injectable()
export class StoreEmployeeGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<EmployeeRequest>();
    const auth = req.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido');
    }

    try {
      const secret = this.config.getOrThrow<string>('JWT_SECRET');
      const payload = this.jwt.verify<EmployeeJwtPayload>(auth.slice(7), {
        secret,
      });

      if (payload.type !== 'store_employee') {
        throw new UnauthorizedException('Token inválido para este recurso');
      }

      req.employee = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
