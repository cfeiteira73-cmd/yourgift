import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  SecurityCertificationService,
  CertificationScore,
  CombinedSecurityPosture,
} from './security-certification.service';

@Controller('admin/security-certification')
@UseGuards(AdminAuthGuard)
export class SecurityCertificationController {
  constructor(
    private readonly securityCertification: SecurityCertificationService,
  ) {}

  // ── GET /admin/security-certification/soc2 ────────────────────────────────

  @Get('soc2')
  getSoc2ReadinessScore(): CertificationScore {
    return this.securityCertification.getSoc2ReadinessScore();
  }

  // ── GET /admin/security-certification/iso27001 ────────────────────────────

  @Get('iso27001')
  getIso27001ReadinessScore(): CertificationScore {
    return this.securityCertification.getIso27001ReadinessScore();
  }

  // ── GET /admin/security-certification/posture ─────────────────────────────

  @Get('posture')
  getCombinedSecurityPosture(): CombinedSecurityPosture {
    return this.securityCertification.getCombinedSecurityPosture();
  }
}
