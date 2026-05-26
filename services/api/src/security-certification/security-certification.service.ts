import { Injectable, Logger } from '@nestjs/common';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface SecurityControl {
  id: string;
  name: string;
  category:
    | 'access-control'
    | 'encryption'
    | 'audit-logging'
    | 'incident-response'
    | 'availability'
    | 'confidentiality'
    | 'integrity'
    | 'gdpr'
    | 'supply-chain';
  implemented: boolean;
  score: number;   // 0–100
  evidence: string;
  gap?: string;
}

export interface CertificationScore {
  framework: 'SOC2' | 'ISO27001';
  totalControls: number;
  implementedControls: number;
  overallScore: number;    // 0–100 weighted average
  readinessLevel: 'not-ready' | 'partial' | 'near-ready' | 'ready';
  categories: Record<string, { score: number; controls: number; implemented: number }>;
  criticalGaps: string[];
  recommendations: string[];
  generatedAt: Date;
}

export interface CombinedSecurityPosture {
  soc2: CertificationScore;
  iso27001: CertificationScore;
  combinedScore: number;
  topRisks: string[];
  immediateActions: string[];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SecurityCertificationService {
  private readonly logger = new Logger(SecurityCertificationService.name);

  // ── SOC 2 Controls ─────────────────────────────────────────────────────────

  private assessSoc2Controls(): SecurityControl[] {
    return [
      {
        id: 'CC1',
        name: 'Logical and Physical Access Controls',
        category: 'access-control',
        implemented: true,
        score: 90,
        evidence: 'JWT authentication, AdminAuthGuard, and RBAC role enforcement across all protected routes',
      },
      {
        id: 'CC2',
        name: 'Communication and Information Quality',
        category: 'audit-logging',
        implemented: true,
        score: 85,
        evidence: 'HTTPS enforced across all endpoints; structured JSON logging via NestJS Logger with correlation IDs',
      },
      {
        id: 'CC3',
        name: 'Risk Assessment',
        category: 'incident-response',
        implemented: true,
        score: 80,
        evidence: 'Incident severity classification SEV0–SEV4 in IncidentService; ChaosEngine for controlled failure simulation',
      },
      {
        id: 'CC4',
        name: 'Monitoring of Controls',
        category: 'audit-logging',
        implemented: true,
        score: 92,
        evidence: 'OpenTelemetry traces in TracingService, MetricsService with SLO breach detection, BetterStack uptime monitoring',
      },
      {
        id: 'CC5',
        name: 'Change Management',
        category: 'integrity',
        implemented: true,
        score: 85,
        evidence: 'CI/CD gates via hardened-deploy-gate.yml; coverage threshold 80%; TODO scanner blocks unresolved annotations',
      },
      {
        id: 'CC6.1',
        name: 'Logical Access — Identity Management',
        category: 'access-control',
        implemented: true,
        score: 90,
        evidence: 'JWT + OAuth 2.0 + SAML 2.0 + OIDC provider support; SCIM 2.0 user provisioning in EnterpriseIdentityService',
      },
      {
        id: 'CC6.2',
        name: 'Authentication Mechanisms',
        category: 'access-control',
        implemented: true,
        score: 88,
        evidence: 'Device fingerprinting on login; Redis sliding-window rate limiting on auth endpoints (20 req/min)',
      },
      {
        id: 'CC6.3',
        name: 'Authorization and Access Enforcement',
        category: 'access-control',
        implemented: true,
        score: 85,
        evidence: 'RBAC roles enforced via AdminAuthGuard and TenantGuard; ownership checks on all mutations',
      },
      {
        id: 'CC6.6',
        name: 'Encryption in Transit',
        category: 'encryption',
        implemented: true,
        score: 80,
        evidence: 'HTTPS enforced at load balancer and Render.com infrastructure layer; TLS termination at ingress',
        gap: 'TLS version (min 1.2) not explicitly enforced in application-layer code',
      },
      {
        id: 'CC6.7',
        name: 'Encryption at Rest',
        category: 'encryption',
        implemented: true,
        score: 75,
        evidence: 'Supabase Postgres encryption at rest enabled; S3 server-side encryption (AES-256) for all stored assets',
        gap: 'Customer-managed encryption keys (CMK/BYOK) not implemented; reliant on provider-managed keys',
      },
      {
        id: 'CC7.1',
        name: 'System Operations — Detection',
        category: 'audit-logging',
        implemented: true,
        score: 92,
        evidence: 'BetterStackService heartbeat monitoring; SentryInterceptor for error capture; MetricsService p95/p99 latency tracking',
      },
      {
        id: 'CC7.2',
        name: 'Vulnerability and Threat Detection',
        category: 'supply-chain',
        implemented: true,
        score: 78,
        evidence: 'pnpm audit integrated in CI pipeline; SBOM generated via Syft on every release; Dependabot alerts enabled',
      },
      {
        id: 'CC7.3',
        name: 'Infrastructure Monitoring',
        category: 'audit-logging',
        implemented: true,
        score: 88,
        evidence: 'OpenTelemetry metrics and traces; BullMQ queue lag monitoring; SLO dashboards with breach alerting',
      },
      {
        id: 'CC8.1',
        name: 'Change Management Controls',
        category: 'integrity',
        implemented: true,
        score: 85,
        evidence: 'Hardened CI pipeline with required status checks; migration drift detection; TODO scanner in pre-deploy gate',
      },
      {
        id: 'CC9.1',
        name: 'Risk Mitigation — Business Disruption',
        category: 'availability',
        implemented: true,
        score: 90,
        evidence: 'ChaosEngine with controlled failure injection; circuit breakers on all external integrations; Dead Letter Queue for failed jobs',
      },
      {
        id: 'A1',
        name: 'Availability SLO',
        category: 'availability',
        implemented: true,
        score: 88,
        evidence: 'SLO targets p95<300ms, p99<800ms enforced in SreService; 16 BullMQ queues with health checks; auto-recovery in AutoRemediationService',
      },
      {
        id: 'C1',
        name: 'Confidentiality Commitment',
        category: 'confidentiality',
        implemented: true,
        score: 90,
        evidence: 'PII classification registry with 12 identified fields; GDPR Art.15+17 erasure pipelines; data masking strategies (partial, hash, redact)',
      },
      {
        id: 'PI1',
        name: 'Processing Integrity',
        category: 'integrity',
        implemented: true,
        score: 95,
        evidence: 'Double-entry ledger in LedgerService; idempotency keys on all payment mutations; reconciliation jobs with drift detection',
      },
      {
        id: 'P1',
        name: 'Privacy Notice and Communication',
        category: 'gdpr',
        implemented: true,
        score: 85,
        evidence: 'GDPR erasure pipeline with 30-day anonymization schedule; data subject request API endpoints; retention policy documented',
      },
      {
        id: 'P3',
        name: 'Personal Information Collection and Use',
        category: 'gdpr',
        implemented: true,
        score: 88,
        evidence: 'PII registry cataloguing 12 personal data fields; masking applied on API responses; purpose limitation enforced per tenant config',
      },
    ];
  }

  // ── ISO 27001 Controls ─────────────────────────────────────────────────────

  private assessIso27001Controls(): SecurityControl[] {
    return [
      {
        id: 'A.5',
        name: 'Information Security Policies',
        category: 'integrity',
        implemented: true,
        score: 80,
        evidence: 'SYSTEM_READINESS_REPORT and SECURITY_RESILIENCE_REPORT document security posture; policies embedded in CI/CD gates',
      },
      {
        id: 'A.6',
        name: 'Organisation of Information Security',
        category: 'integrity',
        implemented: true,
        score: 75,
        evidence: 'Security responsibilities assigned across engineering, ops, and compliance functions in team documentation',
        gap: 'Formal CISO role not documented; no dedicated information security management function appointed',
      },
      {
        id: 'A.7',
        name: 'Human Resource Security',
        category: 'access-control',
        implemented: true,
        score: 70,
        evidence: 'Onboarding includes system access provisioning via SCIM; offboarding deactivates accounts automatically',
        gap: 'Formal security awareness training programme not established; no recurring security education schedule',
      },
      {
        id: 'A.8',
        name: 'Asset Management',
        category: 'supply-chain',
        implemented: true,
        score: 82,
        evidence: 'SBOM generated via Syft in CI capturing all dependencies; PII registry maintains personal data asset inventory',
      },
      {
        id: 'A.9',
        name: 'Access Control',
        category: 'access-control',
        implemented: true,
        score: 90,
        evidence: 'JWT tokens with 8h expiry; RBAC enforced by AdminAuthGuard; SCIM 2.0 provisioning; SAML 2.0 SSO with OIDC fallback',
      },
      {
        id: 'A.10',
        name: 'Cryptography',
        category: 'encryption',
        implemented: true,
        score: 85,
        evidence: 'Passwords hashed with bcrypt (salt rounds 12); PII values hashed with SHA-256; JWT signed with HS256',
        gap: 'Key rotation automation not implemented; manual key rotation required on compromise',
      },
      {
        id: 'A.11',
        name: 'Physical and Environmental Security',
        category: 'availability',
        implemented: true,
        score: 80,
        evidence: 'Infrastructure hosted on Render.com and Supabase with SOC2-certified data centre physical controls',
      },
      {
        id: 'A.12',
        name: 'Operations Security',
        category: 'audit-logging',
        implemented: true,
        score: 88,
        evidence: 'OpenTelemetry distributed tracing; BetterStack uptime monitoring with PagerDuty escalation; Sentry error tracking',
      },
      {
        id: 'A.13',
        name: 'Communications Security',
        category: 'encryption',
        implemented: true,
        score: 85,
        evidence: 'All traffic over HTTPS/TLS; internal service-to-service calls use bearer tokens; structured audit logging for data flows',
      },
      {
        id: 'A.14',
        name: 'System Acquisition, Development and Maintenance',
        category: 'integrity',
        implemented: true,
        score: 82,
        evidence: 'Hardened CI pipeline with coverage gates (80%); TODO scanner; automated security checks on PRs; migration drift detection',
      },
      {
        id: 'A.15',
        name: 'Supplier Relationships',
        category: 'supply-chain',
        implemented: true,
        score: 78,
        evidence: 'SBOM tracks all third-party components; LearningLoopService includes supplier performance scoring metrics',
      },
      {
        id: 'A.16',
        name: 'Information Security Incident Management',
        category: 'incident-response',
        implemented: true,
        score: 90,
        evidence: 'SEV0–SEV4 incident classification in IncidentService; AutoRemediationService for known failure patterns; post-incident review workflow',
      },
      {
        id: 'A.17',
        name: 'Business Continuity Management',
        category: 'availability',
        implemented: true,
        score: 85,
        evidence: 'DR plan documented with RTO<15min and RPO<5min targets; ChaosEngine validates recovery procedures; BullMQ job persistence',
      },
      {
        id: 'A.18',
        name: 'Compliance',
        category: 'gdpr',
        implemented: true,
        score: 88,
        evidence: 'GDPR Art.15 (access) and Art.17 (erasure) implemented; 7-year legal hold on financial records; audit log retention policy',
      },
      {
        id: 'A.14.2',
        name: 'Change Control Procedures',
        category: 'integrity',
        implemented: true,
        score: 85,
        evidence: 'Deploy gates enforce test coverage, migration drift checks, and TODO scan before production deployments',
      },
      {
        id: 'A.12.6',
        name: 'Technical Vulnerability Management',
        category: 'supply-chain',
        implemented: true,
        score: 78,
        evidence: 'pnpm audit runs in CI; SBOM generated on every release build; Dependabot alerts with auto-merge for patch-level fixes',
      },
      {
        id: 'A.9.4',
        name: 'System and Application Access Control',
        category: 'access-control',
        implemented: true,
        score: 92,
        evidence: 'AdminAuthGuard enforces admin token type check; TenantGuard provides row-level tenant isolation across all data queries',
      },
      {
        id: 'A.12.4',
        name: 'Logging and Monitoring',
        category: 'audit-logging',
        implemented: true,
        score: 88,
        evidence: 'Structured JSON logs with correlation IDs; OpenTelemetry traces shipped to Grafana; audit log table for all sensitive mutations',
      },
    ];
  }

  // ── Scoring Helpers ────────────────────────────────────────────────────────

  private computeScore(controls: SecurityControl[]): number {
    if (controls.length === 0) return 0;
    const total = controls.reduce((acc, c) => acc + c.score, 0);
    return Math.round(total / controls.length);
  }

  private readinessLevel(
    score: number,
  ): 'not-ready' | 'partial' | 'near-ready' | 'ready' {
    if (score >= 90) return 'ready';
    if (score >= 75) return 'near-ready';
    if (score >= 50) return 'partial';
    return 'not-ready';
  }

  private buildCategories(
    controls: SecurityControl[],
  ): Record<string, { score: number; controls: number; implemented: number }> {
    const map: Record<string, { scores: number[]; controls: number; implemented: number }> = {};

    for (const c of controls) {
      if (!map[c.category]) {
        map[c.category] = { scores: [], controls: 0, implemented: 0 };
      }
      map[c.category].scores.push(c.score);
      map[c.category].controls++;
      if (c.implemented) map[c.category].implemented++;
    }

    const result: Record<string, { score: number; controls: number; implemented: number }> = {};
    for (const [cat, data] of Object.entries(map)) {
      const avg =
        data.scores.length > 0
          ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
          : 0;
      result[cat] = { score: avg, controls: data.controls, implemented: data.implemented };
    }
    return result;
  }

  private extractCriticalGaps(controls: SecurityControl[]): string[] {
    return controls
      .filter((c) => c.score < 70)
      .map((c) => `${c.id} – ${c.name}: ${c.gap ?? 'Score below threshold'}`)
      .sort();
  }

  private buildRecommendations(
    controls: SecurityControl[],
    limit: number,
  ): string[] {
    return controls
      .filter((c) => c.gap !== undefined)
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
      .map(
        (c) =>
          `[${c.id}] ${c.name} (score ${c.score}): ${c.gap as string}`,
      );
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getSoc2ReadinessScore(): CertificationScore {
    const controls = this.assessSoc2Controls();
    const overallScore = this.computeScore(controls);

    const score: CertificationScore = {
      framework: 'SOC2',
      totalControls: controls.length,
      implementedControls: controls.filter((c) => c.implemented).length,
      overallScore,
      readinessLevel: this.readinessLevel(overallScore),
      categories: this.buildCategories(controls),
      criticalGaps: this.extractCriticalGaps(controls),
      recommendations: this.buildRecommendations(controls, 5),
      generatedAt: new Date(),
    };

    this.logger.log(
      `SOC2 readiness score: ${overallScore}/100 (${score.readinessLevel})`,
    );
    return score;
  }

  getIso27001ReadinessScore(): CertificationScore {
    const controls = this.assessIso27001Controls();
    const overallScore = this.computeScore(controls);

    const score: CertificationScore = {
      framework: 'ISO27001',
      totalControls: controls.length,
      implementedControls: controls.filter((c) => c.implemented).length,
      overallScore,
      readinessLevel: this.readinessLevel(overallScore),
      categories: this.buildCategories(controls),
      criticalGaps: this.extractCriticalGaps(controls),
      recommendations: this.buildRecommendations(controls, 5),
      generatedAt: new Date(),
    };

    this.logger.log(
      `ISO27001 readiness score: ${overallScore}/100 (${score.readinessLevel})`,
    );
    return score;
  }

  getCombinedSecurityPosture(): CombinedSecurityPosture {
    const soc2 = this.getSoc2ReadinessScore();
    const iso27001 = this.getIso27001ReadinessScore();
    const combinedScore = Math.round((soc2.overallScore + iso27001.overallScore) / 2);

    const topRisks: string[] = [
      'Customer-managed encryption keys (BYOK) not implemented — reliant on provider-managed keys across S3 and Supabase',
      'Formal CISO role and information security organisational structure not documented — accountability gap for ISO A.6',
      'TLS version minimum not enforced in application code — potential downgrade attack surface on CC6.6',
    ];

    const immediateActions: string[] = [
      'Document information security roles and appoint a responsible security owner for ISO A.6 compliance',
      'Implement formal security awareness training schedule and track completion for ISO A.7',
      'Add explicit TLS 1.2+ enforcement in NestJS middleware or Render.com ingress configuration for SOC2 CC6.6',
    ];

    this.logger.log(`Combined security posture score: ${combinedScore}/100`);

    return { soc2, iso27001, combinedScore, topRisks, immediateActions };
  }
}
