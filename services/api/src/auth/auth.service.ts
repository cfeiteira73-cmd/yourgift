import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const client = await this.prisma.client.findUnique({ where: { email } });
    if (!client || !client.passwordHash) throw new UnauthorizedException();
    const valid = await bcrypt.compare(password, client.passwordHash);
    if (!valid) throw new UnauthorizedException();
    return client;
  }

  async login(client: { id: string; email: string; tier: string }) {
    const payload = { sub: client.id, email: client.email, tier: client.tier };
    return { access_token: this.jwt.sign(payload) };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
