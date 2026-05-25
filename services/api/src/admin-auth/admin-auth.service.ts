import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TotpService } from './totp.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

// ─── JWT payload shapes ────────────────────────────────────────────────────

interface AdminTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  type: 'admin';
  /** Present only after MFA is enrolled; true once /mfa/verify is completed. */
  mfaVerified?: boolean;
}

// ─── Public return types ───────────────────────────────────────────────────

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
}

export interface LoginResult {
  token: string;
  admin: { id: string; email: string; name: string; role: string };
  /** If true, the client must POST /admin-auth/mfa/verify before accessing any protected route. */
  mfaRequired: boolean;
}

export interface MfaSetupResult {
  secret: string;
  qrUri: string;
}

export interface MfaEnableResult {
  /** One-time list of plain-text backup codes — store securely. */
  backupCodes: string[];
}

// ─── Service ───────────────────────────────────────────────────────────────

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly totp: TotpService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultAdmin();
  }

  // ─── Password helpers ──────────────────────────────────────────────────

  private hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  private comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  // ─── Token helpers ─────────────────────────────────────────────────────

  private signToken(payload: AdminTokenPayload): string {
    return this.jwt.sign(payload);
  }

  // ─── Login ─────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<LoginResult> {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await this.comparePassword(password, admin.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const mfaRequired = admin.mfaEnabled;

    // If MFA is enrolled the token is intentionally marked mfaVerified=false.
    // The client must complete /mfa/verify to get a fully-scoped token.
    const payload: AdminTokenPayload = {
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      type: 'admin',
      ...(admin.mfaEnabled ? { mfaVerified: false } : {}),
    };

    const token = this.signToken(payload);

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
      mfaRequired,
    };
  }

  // ─── MFA Setup ─────────────────────────────────────────────────────────

  /**
   * Generates a new TOTP secret for the admin and persists it (not yet enabled).
   * Returns the secret and QR URI. Called by POST /admin-auth/mfa/setup.
   */
  async setupMfa(adminId: string): Promise<MfaSetupResult> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.mfaEnabled) {
      throw new ConflictException('MFA is already enabled for this account');
    }

    const secret = this.totp.generateSecret();
    const qrUri = this.totp.getTotpUri(secret, admin.email);

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { mfaSecret: secret },
    });

    return { secret, qrUri };
  }

  // ─── MFA Enable ────────────────────────────────────────────────────────

  /**
   * Confirms the first TOTP code, marks MFA as enabled and generates 8 backup codes.
   * Returns the one-time plain-text backup codes. Called by POST /admin-auth/mfa/enable.
   */
  async enableMfa(adminId: string, code: string): Promise<MfaEnableResult> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.mfaEnabled) {
      throw new ConflictException('MFA is already enabled');
    }
    if (!admin.mfaSecret) {
      throw new BadRequestException(
        'MFA setup not started — call /mfa/setup first',
      );
    }

    const valid = this.totp.validateCode(admin.mfaSecret, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Generate 8 backup codes: 16 hex chars each (64 bits of entropy).
    const plainCodes: string[] = Array.from({ length: 8 }, () =>
      randomBytes(8).toString('hex'),
    );
    // Store bcrypt hashes so the plain codes are not recoverable from DB.
    const hashedCodes = await Promise.all(
      plainCodes.map((c) => bcrypt.hash(c, 10)),
    );

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        mfaEnabled: true,
        mfaVerifiedAt: new Date(),
        mfaBackupCodes: hashedCodes,
      },
    });

    return { backupCodes: plainCodes };
  }

  // ─── MFA Verify (session step-up) ──────────────────────────────────────

  /**
   * Validates the TOTP code (or a backup code) and issues a new JWT with
   * mfaVerified=true. Called by POST /admin-auth/mfa/verify.
   */
  async verifyMfa(adminId: string, code: string): Promise<{ token: string }> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    if (!admin.mfaEnabled || !admin.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    // Try TOTP first, then backup codes.
    let verified = this.totp.validateCode(admin.mfaSecret, code);

    if (!verified) {
      verified = await this.tryBackupCode(admin.id, admin.mfaBackupCodes, code);
    }

    if (!verified) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    const payload: AdminTokenPayload = {
      sub: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      type: 'admin',
      mfaVerified: true,
    };

    return { token: this.signToken(payload) };
  }

  /**
   * Checks a backup code against stored hashes.
   * If matched, removes that hash from the list (single-use).
   */
  private async tryBackupCode(
    adminId: string,
    hashedCodes: string[],
    candidate: string,
  ): Promise<boolean> {
    for (let i = 0; i < hashedCodes.length; i++) {
      const match = await bcrypt.compare(candidate, hashedCodes[i]);
      if (match) {
        // Consume the backup code — remove it from the stored list.
        const remaining = hashedCodes.filter((_, idx) => idx !== i);
        await this.prisma.adminUser.update({
          where: { id: adminId },
          data: { mfaBackupCodes: remaining },
        });
        return true;
      }
    }
    return false;
  }

  // ─── MFA Disable ───────────────────────────────────────────────────────

  /**
   * Disables MFA entirely. Requires the current TOTP code to confirm intent.
   * Called by DELETE /admin-auth/mfa.
   */
  async disableMfa(adminId: string, code: string): Promise<void> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    if (!admin.mfaEnabled || !admin.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    const valid = this.totp.validateCode(admin.mfaSecret, code);
    if (!valid) {
      throw new UnauthorizedException('Invalid TOTP code — cannot disable MFA');
    }

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaVerifiedAt: null,
        mfaBackupCodes: [],
      },
    });
  }

  // ─── Admin CRUD ────────────────────────────────────────────────────────

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

  async getProfile(id: string): Promise<AdminProfile> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async listAdmins(): Promise<AdminProfile[]> {
    return this.prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mfaEnabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Seeding ───────────────────────────────────────────────────────────

  async seedDefaultAdmin(): Promise<void> {
    try {
      const existing = await this.prisma.adminUser.findUnique({
        where: { email: 'admin@yourgift.pt' },
      });
      if (existing) return;

      const password =
        this.config.get<string>('ADMIN_DEFAULT_PASSWORD') ??
        randomBytes(16).toString('hex');

      await this.createAdmin('admin@yourgift.pt', 'Super Admin', password, 'admin');
      this.logger.log('Default admin created: admin@yourgift.pt');
      if (this.config.get('NODE_ENV') !== 'production') {
        this.logger.debug(`Default admin password: ${password}`);
      }
    } catch {
      // DB may not be ready yet during initial boot — suppress gracefully.
    }
  }
}
