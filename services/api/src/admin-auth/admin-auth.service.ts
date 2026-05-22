import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

interface AdminTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  type: 'admin';
}

@Injectable()
export class AdminAuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultAdmin();
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private async comparePassword(
    plain: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    token: string;
    admin: { id: string; email: string; name: string; role: string };
  }> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await this.comparePassword(password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload: AdminTokenPayload = {
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      type: 'admin',
    };

    const token = this.jwt.sign(payload);

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  async createAdmin(
    email: string,
    name: string,
    password: string,
    role = 'manager',
  ): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date;
  }> {
    const passwordHash = await this.hashPassword(password);
    return this.prisma.adminUser.create({
      data: { email, name, passwordHash, role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async getProfile(id: string): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
  }> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async listAdmins(): Promise<
    Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
    }>
  > {
    return this.prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async seedDefaultAdmin(): Promise<void> {
    try {
      const existing = await this.prisma.adminUser.findUnique({
        where: { email: 'admin@yourgift.pt' },
      });
      if (existing) return;
      await this.createAdmin(
        'admin@yourgift.pt',
        'Super Admin',
        'YourGift2026!',
        'admin',
      );
      console.log(
        '✓ Default admin created: admin@yourgift.pt / YourGift2026!',
      );
    } catch {
      // DB may not be ready yet during initial boot — suppress gracefully
    }
  }
}
