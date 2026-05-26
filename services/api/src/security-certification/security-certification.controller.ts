import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  SecurityCertificationService,
  CertificationScore,
  CombinedSecurityPosture,
} from './security-certification.service';
import {
  EvidenceExportService,
  EvidencePackage,
  SupportingMetrics,
} from './evidence-export.service';

@Controller('admin/security-certification')
@UseGuards(AdminAuthGuard)
export class SecurityCertificationController {
  constructor(
    private readonly securityCertification: SecurityCertificationService,
    private readonly evidenceExport: EvidenceExportService,
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

  // ── GET /admin/security-certification/evidence/soc2 ──────────────────────
  // Query params: from (ISO8601), to (ISO8601)
  // Defaults: from = 90 days ago, to = now

  @Get('evidence/soc2')
  async getSoc2Evidence(
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ): Promise<EvidencePackage> {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr
      ? new Date(fromStr)
      : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
    return this.evidenceExport.generateSoc2Evidence(from, to);
  }

  // ── GET /admin/security-certification/evidence/iso27001 ───────────────────

  @Get('evidence/iso27001')
  async getIso27001Evidence(
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ): Promise<EvidencePackage> {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr
      ? new Date(fromStr)
      : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
    return this.evidenceExport.generateIso27001Evidence(from, to);
  }

  // ── GET /admin/security-certification/evidence/metrics ────────────────────

  @Get('evidence/metrics')
  async getSupportingMetrics(
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ): Promise<SupportingMetrics> {
    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr
      ? new Date(fromStr)
      : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
    return this.evidenceExport.getSupportingMetrics(from, to);
  }
}
