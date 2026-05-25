import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  AdminAuthService,
  AdminProfile,
  LoginResult,
  MfaSetupResult,
  MfaEnableResult,
} from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { SkipMfa } from './admin-auth.guard';

interface AdminRequest {
  user: {
    sub: string;
    email: string;
    name: string;
    role: string;
    type: string;
    mfaVerified?: boolean;
  };
}

@Controller('admin-auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  // ─── Public: initial login ────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() body: { email: string; password: string },
  ): Promise<LoginResult> {
    return this.adminAuthService.login(body.email, body.password);
  }

  // ─── MFA flow (JWT required, MFA check skipped on these routes) ────────

  /**
   * POST /admin-auth/mfa/setup
   * Generates a new TOTP secret + QR URI for the authenticated admin.
   * Must be called before /mfa/enable.
   */
  @Post('mfa/setup')
  @UseGuards(AdminAuthGuard)
  @SkipMfa()
  @HttpCode(HttpStatus.OK)
  setupMfa(@Request() req: AdminRequest): Promise<MfaSetupResult> {
    return this.adminAuthService.setupMfa(req.user.sub);
  }

  /**
   * POST /admin-auth/mfa/enable
   * Confirms the first TOTP code and activates MFA.
   * Returns one-time plain-text backup codes.
   */
  @Post('mfa/enable')
  @UseGuards(AdminAuthGuard)
  @SkipMfa()
  @HttpCode(HttpStatus.OK)
  enableMfa(
    @Request() req: AdminRequest,
    @Body() body: { code: string },
  ): Promise<MfaEnableResult> {
    return this.adminAuthService.enableMfa(req.user.sub, body.code);
  }

  /**
   * POST /admin-auth/mfa/verify
   * Validates TOTP code (or backup code) and issues a fully-scoped JWT
   * with mfaVerified=true. Call this immediately after login when mfaRequired=true.
   */
  @Post('mfa/verify')
  @UseGuards(AdminAuthGuard)
  @SkipMfa()
  @HttpCode(HttpStatus.OK)
  verifyMfa(
    @Request() req: AdminRequest,
    @Body() body: { code: string },
  ): Promise<{ token: string }> {
    return this.adminAuthService.verifyMfa(req.user.sub, body.code);
  }

  /**
   * DELETE /admin-auth/mfa
   * Disables MFA for the authenticated admin.
   * Requires the current TOTP code to confirm intent.
   */
  @Delete('mfa')
  @UseGuards(AdminAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableMfa(
    @Request() req: AdminRequest,
    @Body() body: { code: string },
  ): Promise<void> {
    return this.adminAuthService.disableMfa(req.user.sub, body.code);
  }

  // ─── Protected admin routes ────────────────────────────────────────────

  @Get('profile')
  @UseGuards(AdminAuthGuard)
  getProfile(@Request() req: AdminRequest): Promise<AdminProfile> {
    return this.adminAuthService.getProfile(req.user.sub);
  }

  @Get('admins')
  @UseGuards(AdminAuthGuard)
  listAdmins(): Promise<AdminProfile[]> {
    return this.adminAuthService.listAdmins();
  }
}
