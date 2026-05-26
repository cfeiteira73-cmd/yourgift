import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface EvidenceControl {
  controlId: string;
  title: string;
  evidenceType: 'log' | 'config' | 'metric' | 'attestation';
  evidenceCount: number;
  sampleEvidence: unknown[];
  status: 'satisfied' | 'partial' | 'gap';
  gapDescription?: string;
}

export interface EvidencePackage {
  generatedAt: Date;
  periodCovered: { from: Date; to: Date };
  framework: 'SOC2' | 'ISO27001';
  controls: EvidenceControl[];
  summary: {
    totalControls: number;
    satisfied: number;
    partial: number;
    gaps: number;
    overallScore: number;
  };
}

export interface SupportingMetrics {
  totalEventLogs: number;
  totalAuthAuditLogs: number;
  totalDeployments: number;
  totalIncidents: number;
  totalAutoRemediations: number;
  totalChaosDrills: number;
  chaosDrillsRtoMet: number;
  avgMttrMinutes: number | null;
  failedAuthAttempts: number;
  successfulLogins: number;
  mfaEvents: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class EvidenceExportService {
  private readonly logger = new Logger(EvidenceExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── SOC2 Evidence ──────────────────────────────────────────────────────────

  async generateSoc2Evidence(from: Date, to: Date): Promise<EvidencePackage> {
    this.logger.log(
      `Generating SOC2 evidence package from ${from.toISOString()} to ${to.toISOString()}`,
    );

    const controls = await Promise.all([
      this.cc61AccessControl(from, to),
      this.cc62Authentication(from, to),
      this.cc71IncidentResponse(from, to),
      this.cc74Monitoring(from, to),
      this.cc81ChangeManagement(from, to),
      this.cc91RiskAssessment(from, to),
    ]);

    const summary = this.buildSummary(controls);

    this.logger.log(
      `SOC2 evidence generated: ${summary.satisfied}/${summary.totalControls} satisfied, score ${summary.overallScore}`,
    );

    return {
      generatedAt: new Date(),
      periodCovered: { from, to },
      framework: 'SOC2',
      controls,
      summary,
    };
  }

  // ── ISO 27001 Evidence ─────────────────────────────────────────────────────

  async generateIso27001Evidence(from: Date, to: Date): Promise<EvidencePackage> {
    this.logger.log(
      `Generating ISO27001 evidence package from ${from.toISOString()} to ${to.toISOString()}`,
    );

    const controls = await Promise.all([
      this.a91AccessPolicy(from, to),
      this.a124AuditLogging(from, to),
      this.a161IncidentManagement(from, to),
      this.a142ChangeControl(from, to),
    ]);

    const summary = this.buildSummary(controls);

    this.logger.log(
      `ISO27001 evidence generated: ${summary.satisfied}/${summary.totalControls} satisfied, score ${summary.overallScore}`,
    );

    return {
      generatedAt: new Date(),
      periodCovered: { from, to },
      framework: 'ISO27001',
      controls,
      summary,
    };
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  exportToJson(pkg: EvidencePackage): string {
    return JSON.stringify(pkg, null, 2);
  }

  // ── Supporting Metrics ─────────────────────────────────────────────────────

  async getSupportingMetrics(from: Date, to: Date): Promise<SupportingMetrics> {
    const dateFilter = { gte: from, lte: to };

    const [
      totalEventLogs,
      totalAuthAuditLogs,
      totalDeployments,
      totalIncidents,
      totalAutoRemediations,
      chaosDrills,
      chaosDrillsRtoMet,
      failedAuthAttempts,
      successfulLogins,
      mfaEvents,
      mttrResult,
    ] = await Promise.all([
      // Total event log records in period — proves continuous logging
      this.prisma.eventLog.count({ where: { createdAt: dateFilter } }),

      // Total auth audit log records in period
      this.prisma.authAuditLog.count({ where: { createdAt: dateFilter } }),

      // Deployments: eventLog events starting with 'deployment.'
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'deployment.' }, createdAt: dateFilter },
      }),

      // Incidents: eventLog events starting with 'incident.'
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'incident.' }, createdAt: dateFilter },
      }),

      // Auto-remediations: SRE automated recovery actions
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'sre.auto-remediation' }, createdAt: dateFilter },
      }),

      // Chaos drills in period
      this.prisma.chaosDrill.count({
        where: { createdAt: dateFilter },
      }),

      // Chaos drills where RTO was met
      this.prisma.chaosDrill.count({
        where: { createdAt: dateFilter, rtoMet: true },
      }),

      // Failed auth attempts
      this.prisma.authAuditLog.count({
        where: { createdAt: dateFilter, success: false },
      }),

      // Successful logins
      this.prisma.authAuditLog.count({
        where: {
          createdAt: dateFilter,
          success: true,
          action: { in: ['login', 'oauth.callback', 'magic_link.verify'] },
        },
      }),

      // MFA events
      this.prisma.authAuditLog.count({
        where: {
          createdAt: dateFilter,
          action: { startsWith: 'mfa.' },
        },
      }),

      // Average MTTR across completed chaos drills
      this.prisma.chaosDrill.aggregate({
        where: { createdAt: dateFilter, status: 'completed', mttrMinutes: { not: null } },
        _avg: { mttrMinutes: true },
      }),
    ]);

    return {
      totalEventLogs,
      totalAuthAuditLogs,
      totalDeployments,
      totalIncidents,
      totalAutoRemediations,
      totalChaosDrills: chaosDrills,
      chaosDrillsRtoMet,
      avgMttrMinutes: mttrResult._avg.mttrMinutes ?? null,
      failedAuthAttempts,
      successfulLogins,
      mfaEvents,
    };
  }

  // ── SOC2 Control Implementations ───────────────────────────────────────────

  /**
   * CC6.1 — Logical Access: Identity Management
   * Evidence: AuthAuditLog login events, provisioning events, MFA usage.
   */
  private async cc61AccessControl(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [loginEvents, mfaEvents, provisioningEvents, sample] = await Promise.all([
      this.prisma.authAuditLog.count({
        where: { createdAt: dateFilter, action: { in: ['login', 'oauth.callback', 'magic_link.verify'] } },
      }),
      this.prisma.authAuditLog.count({
        where: { createdAt: dateFilter, action: { startsWith: 'mfa.' } },
      }),
      this.prisma.authAuditLog.count({
        where: { createdAt: dateFilter, action: { in: ['user.provisioned', 'user.deprovisioned', 'scim.sync'] } },
      }),
      this.prisma.authAuditLog.findMany({
        where: { createdAt: dateFilter },
        select: { id: true, action: true, email: true, success: true, createdAt: true, ip: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const totalEvents = loginEvents + mfaEvents + provisioningEvents;
    const status = totalEvents > 0 ? 'satisfied' : 'partial';

    return {
      controlId: 'CC6.1',
      title: 'Logical Access — Identity Management',
      evidenceType: 'log',
      evidenceCount: totalEvents,
      sampleEvidence: sample,
      status,
      gapDescription:
        status !== 'satisfied'
          ? `No authentication events found in period. Expected login, MFA, and provisioning events in auth_audit_logs.`
          : undefined,
    };
  }

  /**
   * CC6.2 — Authentication Mechanisms
   * Evidence: Failed auth attempts, rate-limiting hits, anomaly detection.
   * Anomaly: more than 10 failures within any single hour constitutes a detected anomaly.
   */
  private async cc62Authentication(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [failedAttempts, totalAttempts, hourlyAnomalyCheck, sample] = await Promise.all([
      this.prisma.authAuditLog.count({
        where: { createdAt: dateFilter, success: false },
      }),
      this.prisma.authAuditLog.count({
        where: { createdAt: dateFilter },
      }),
      // Detect hours with >10 failures (anomaly threshold)
      this.prisma.$queryRaw<Array<{ hour: Date; failures: bigint }>>`
        SELECT
          date_trunc('hour', created_at) AS hour,
          COUNT(*) AS failures
        FROM auth_audit_logs
        WHERE
          created_at BETWEEN ${from} AND ${to}
          AND success = false
        GROUP BY hour
        HAVING COUNT(*) > 10
        ORDER BY failures DESC
        LIMIT 5
      `,
      this.prisma.authAuditLog.findMany({
        where: { createdAt: dateFilter, success: false },
        select: { id: true, action: true, email: true, errorMsg: true, ip: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const anomalyCount = Array.isArray(hourlyAnomalyCheck) ? hourlyAnomalyCheck.length : 0;
    const failureRate = totalAttempts > 0 ? (failedAttempts / totalAttempts) * 100 : 0;

    // Satisfied if: we have auth logs (mechanism is active) and failure rate is tracked
    const status: EvidenceControl['status'] =
      totalAttempts > 0 ? 'satisfied' : 'partial';

    return {
      controlId: 'CC6.2',
      title: 'Authentication Mechanisms',
      evidenceType: 'log',
      evidenceCount: failedAttempts,
      sampleEvidence: [
        {
          totalAuthAttempts: totalAttempts,
          failedAttempts,
          failureRatePct: parseFloat(failureRate.toFixed(2)),
          anomalouHoursDetected: anomalyCount,
          anomalousHours: (hourlyAnomalyCheck as Array<{ hour: Date; failures: bigint }>).map(
            (r) => ({ hour: r.hour, failures: Number(r.failures) }),
          ),
        },
        ...sample,
      ],
      status,
      gapDescription:
        status !== 'satisfied'
          ? 'No authentication attempts recorded — auth_audit_logs may not be populated.'
          : undefined,
    };
  }

  /**
   * CC7.1 — System Operations: Incident Detection and Response
   * Evidence: EventLog incident.* events, SEV0/SEV1 incidents, avg resolution time.
   */
  private async cc71IncidentResponse(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [totalIncidents, sev0Count, sev1Count, sample] = await Promise.all([
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'incident.' }, createdAt: dateFilter },
      }),
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'incident.' }, payload: { path: ['severity'], equals: 'SEV0' }, createdAt: dateFilter },
      }),
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'incident.' }, payload: { path: ['severity'], equals: 'SEV1' }, createdAt: dateFilter },
      }),
      this.prisma.eventLog.findMany({
        where: { event: { startsWith: 'incident.' }, createdAt: dateFilter },
        select: { id: true, event: true, payload: true, createdAt: true, actorType: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Query average resolution time for resolved incidents
    const resolutionMetrics = await this.prisma.$queryRaw<
      Array<{ avg_resolution_minutes: number | null; resolved_count: bigint }>
    >`
      SELECT
        AVG(
          EXTRACT(EPOCH FROM (
            resolved.created_at - opened.created_at
          )) / 60
        ) AS avg_resolution_minutes,
        COUNT(resolved.id) AS resolved_count
      FROM event_logs opened
      LEFT JOIN event_logs resolved
        ON resolved.payload->>'incidentId' = opened.payload->>'incidentId'
        AND resolved.event = 'incident.resolved'
      WHERE
        opened.event = 'incident.created'
        AND opened.created_at BETWEEN ${from} AND ${to}
    `;

    const avgResolution = Array.isArray(resolutionMetrics) && resolutionMetrics.length > 0
      ? resolutionMetrics[0]?.avg_resolution_minutes
      : null;

    const status: EvidenceControl['status'] = totalIncidents >= 0 ? 'satisfied' : 'gap';

    return {
      controlId: 'CC7.1',
      title: 'System Operations — Incident Detection and Response',
      evidenceType: 'log',
      evidenceCount: totalIncidents,
      sampleEvidence: [
        {
          totalIncidents,
          sev0Count,
          sev1Count,
          avgResolutionMinutes:
            avgResolution !== null ? parseFloat(Number(avgResolution).toFixed(2)) : null,
        },
        ...sample,
      ],
      status,
    };
  }

  /**
   * CC7.4 — System Operations: Monitoring and Auto-Remediation
   * Evidence: sre.* EventLog events, auto-remediation action counts.
   */
  private async cc74Monitoring(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [sreEvents, autoRemediations, alertsFired, sample] = await Promise.all([
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'sre.' }, createdAt: dateFilter },
      }),
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'sre.auto-remediation' }, createdAt: dateFilter },
      }),
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'sre.alert' }, createdAt: dateFilter },
      }),
      this.prisma.eventLog.findMany({
        where: { event: { startsWith: 'sre.' }, createdAt: dateFilter },
        select: { id: true, event: true, payload: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Cross-reference SystemAlert table for additional monitoring evidence
    const systemAlerts = await this.prisma.systemAlert.count({
      where: { createdAt: dateFilter },
    });

    const status: EvidenceControl['status'] = sreEvents > 0 ? 'satisfied' : 'partial';

    return {
      controlId: 'CC7.4',
      title: 'System Operations — Monitoring and Auto-Remediation',
      evidenceType: 'metric',
      evidenceCount: sreEvents,
      sampleEvidence: [
        {
          sreEvents,
          autoRemediationActions: autoRemediations,
          alertsFired,
          systemAlertsTotal: systemAlerts,
        },
        ...sample,
      ],
      status,
      gapDescription:
        status !== 'satisfied'
          ? 'No SRE events found in event_logs. Ensure SreService publishes sre.* events to EventLog.'
          : undefined,
    };
  }

  /**
   * CC8.1 — Change Management Controls
   * Evidence: deployment.* EventLog events, change counts, rollback events.
   */
  private async cc81ChangeManagement(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [deployments, rollbacks, successfulDeploys, sample] = await Promise.all([
      this.prisma.eventLog.count({
        where: { event: { startsWith: 'deployment.' }, createdAt: dateFilter },
      }),
      this.prisma.eventLog.count({
        where: { event: 'deployment.rollback', createdAt: dateFilter },
      }),
      this.prisma.eventLog.count({
        where: { event: 'deployment.success', createdAt: dateFilter },
      }),
      this.prisma.eventLog.findMany({
        where: { event: { startsWith: 'deployment.' }, createdAt: dateFilter },
        select: { id: true, event: true, payload: true, createdAt: true, actorType: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const rollbackRate =
      deployments > 0 ? ((rollbacks / deployments) * 100).toFixed(2) : '0.00';

    const status: EvidenceControl['status'] =
      deployments > 0
        ? 'satisfied'
        : 'partial';

    return {
      controlId: 'CC8.1',
      title: 'Change Management Controls',
      evidenceType: 'log',
      evidenceCount: deployments,
      sampleEvidence: [
        {
          totalDeployments: deployments,
          successfulDeployments: successfulDeploys,
          rollbacks,
          rollbackRatePct: parseFloat(rollbackRate),
        },
        ...sample,
      ],
      status,
      gapDescription:
        status !== 'satisfied'
          ? 'No deployment events found in event_logs for this period. Ensure CI/CD pipeline publishes deployment.* events.'
          : undefined,
    };
  }

  /**
   * CC9.1 — Risk Mitigation: Business Disruption Controls
   * Evidence: ChaosDrill completions, RTO met rate, RPO met rate, MTTR.
   */
  private async cc91RiskAssessment(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [totalDrills, completedDrills, rtoMetDrills, rpoMetDrills, sample, mttrAggregate] =
      await Promise.all([
        this.prisma.chaosDrill.count({ where: { createdAt: dateFilter } }),
        this.prisma.chaosDrill.count({ where: { createdAt: dateFilter, status: 'completed' } }),
        this.prisma.chaosDrill.count({ where: { createdAt: dateFilter, rtoMet: true } }),
        this.prisma.chaosDrill.count({ where: { createdAt: dateFilter, rpoMet: true } }),
        this.prisma.chaosDrill.findMany({
          where: { createdAt: dateFilter },
          select: {
            id: true,
            drillType: true,
            targetService: true,
            status: true,
            rtoMet: true,
            rpoMet: true,
            mttrMinutes: true,
            findings: true,
            scheduledAt: true,
            completedAt: true,
          },
          orderBy: { scheduledAt: 'desc' },
          take: 5,
        }),
        this.prisma.chaosDrill.aggregate({
          where: { createdAt: dateFilter, status: 'completed', mttrMinutes: { not: null } },
          _avg: { mttrMinutes: true },
          _min: { mttrMinutes: true },
          _max: { mttrMinutes: true },
        }),
      ]);

    const rtoMetRatePct =
      completedDrills > 0
        ? parseFloat(((rtoMetDrills / completedDrills) * 100).toFixed(2))
        : null;

    const status: EvidenceControl['status'] =
      completedDrills >= 1 && (rtoMetRatePct === null || rtoMetRatePct >= 80)
        ? 'satisfied'
        : completedDrills > 0
        ? 'partial'
        : 'gap';

    return {
      controlId: 'CC9.1',
      title: 'Risk Mitigation — Business Disruption Controls',
      evidenceType: 'attestation',
      evidenceCount: completedDrills,
      sampleEvidence: [
        {
          totalDrills,
          completedDrills,
          rtoMetDrills,
          rpoMetDrills,
          rtoMetRatePct,
          avgMttrMinutes: mttrAggregate._avg.mttrMinutes
            ? parseFloat(mttrAggregate._avg.mttrMinutes.toFixed(2))
            : null,
          minMttrMinutes: mttrAggregate._min.mttrMinutes,
          maxMttrMinutes: mttrAggregate._max.mttrMinutes,
        },
        ...sample,
      ],
      status,
      gapDescription:
        status === 'gap'
          ? 'No completed chaos drills found in period. Schedule and execute at least one chaos drill per quarter to satisfy CC9.1.'
          : status === 'partial'
          ? `RTO met rate (${rtoMetRatePct}%) is below the 80% target. Review failing drills and improve recovery procedures.`
          : undefined,
    };
  }

  // ── ISO 27001 Control Implementations ─────────────────────────────────────

  /**
   * A.9.1 — Access Control Policy
   * Evidence: AuthAuditLog access control events, login success/failure metrics.
   */
  private async a91AccessPolicy(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [accessEvents, successfulAccess, deniedAccess, sample] = await Promise.all([
      this.prisma.authAuditLog.count({ where: { createdAt: dateFilter } }),
      this.prisma.authAuditLog.count({ where: { createdAt: dateFilter, success: true } }),
      this.prisma.authAuditLog.count({ where: { createdAt: dateFilter, success: false } }),
      this.prisma.authAuditLog.findMany({
        where: { createdAt: dateFilter },
        select: { id: true, action: true, email: true, success: true, provider: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Unique actors (users) accessing the system
    const uniqueActors = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT email) AS count
      FROM auth_audit_logs
      WHERE created_at BETWEEN ${from} AND ${to}
        AND email IS NOT NULL
    `;

    const uniqueActorCount =
      Array.isArray(uniqueActors) && uniqueActors.length > 0
        ? Number(uniqueActors[0]?.count ?? 0)
        : 0;

    const accessSuccessRatePct =
      accessEvents > 0
        ? parseFloat(((successfulAccess / accessEvents) * 100).toFixed(2))
        : null;

    const status: EvidenceControl['status'] = accessEvents > 0 ? 'satisfied' : 'partial';

    return {
      controlId: 'A.9.1',
      title: 'Access Control Policy',
      evidenceType: 'log',
      evidenceCount: accessEvents,
      sampleEvidence: [
        {
          totalAccessEvents: accessEvents,
          successfulAccessEvents: successfulAccess,
          deniedAccessEvents: deniedAccess,
          uniqueUsersAccessing: uniqueActorCount,
          accessSuccessRatePct,
        },
        ...sample,
      ],
      status,
      gapDescription:
        status !== 'satisfied'
          ? 'No access control events found. Ensure AdminAuthGuard writes all access decisions to AuthAuditLog.'
          : undefined,
    };
  }

  /**
   * A.12.4 — Logging and Monitoring
   * Evidence: Total EventLog records, coverage density, log continuity check.
   */
  private async a124AuditLogging(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [totalLogs, distinctEventTypes, earliestLog, latestLog] = await Promise.all([
      this.prisma.eventLog.count({ where: { createdAt: dateFilter } }),
      this.prisma.$queryRaw<Array<{ event_type: string; count: bigint }>>`
        SELECT event AS event_type, COUNT(*) AS count
        FROM event_logs
        WHERE created_at BETWEEN ${from} AND ${to}
        GROUP BY event
        ORDER BY count DESC
        LIMIT 20
      `,
      this.prisma.eventLog.findFirst({
        where: { createdAt: dateFilter },
        orderBy: { createdAt: 'asc' },
        select: { id: true, event: true, createdAt: true },
      }),
      this.prisma.eventLog.findFirst({
        where: { createdAt: dateFilter },
        orderBy: { createdAt: 'desc' },
        select: { id: true, event: true, createdAt: true },
      }),
    ]);

    // Check for logging gaps: days with 0 event logs (indicates potential log loss)
    const periodDays = Math.ceil(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    );

    const dailyCounts = await this.prisma.$queryRaw<
      Array<{ day: Date; count: bigint }>
    >`
      SELECT
        date_trunc('day', created_at) AS day,
        COUNT(*) AS count
      FROM event_logs
      WHERE created_at BETWEEN ${from} AND ${to}
      GROUP BY day
      ORDER BY day
    `;

    const daysWithLogs = Array.isArray(dailyCounts) ? dailyCounts.length : 0;
    const loggingCoveragePct =
      periodDays > 0
        ? parseFloat(((daysWithLogs / periodDays) * 100).toFixed(2))
        : 100;

    const status: EvidenceControl['status'] =
      loggingCoveragePct >= 95
        ? 'satisfied'
        : loggingCoveragePct >= 80
        ? 'partial'
        : 'gap';

    return {
      controlId: 'A.12.4',
      title: 'Logging and Monitoring',
      evidenceType: 'log',
      evidenceCount: totalLogs,
      sampleEvidence: [
        {
          totalEventLogRecords: totalLogs,
          periodDays,
          daysWithLogs,
          loggingCoveragePct,
          topEventTypes: (
            Array.isArray(distinctEventTypes) ? distinctEventTypes : []
          ).map((r) => ({ event: r.event_type, count: Number(r.count) })),
          earliestLog,
          latestLog,
        },
      ],
      status,
      gapDescription:
        status !== 'satisfied'
          ? `Logging coverage is ${loggingCoveragePct}% (${daysWithLogs}/${periodDays} days have logs). Gaps detected — review event publishing pipeline.`
          : undefined,
    };
  }

  /**
   * A.16.1 — Information Security Incident Management
   * Evidence: incident.* events, response times, post-incident reviews.
   */
  private async a161IncidentManagement(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [totalIncidents, resolvedIncidents, postIncidentReviews, sample] =
      await Promise.all([
        this.prisma.eventLog.count({
          where: { event: { startsWith: 'incident.' }, createdAt: dateFilter },
        }),
        this.prisma.eventLog.count({
          where: { event: 'incident.resolved', createdAt: dateFilter },
        }),
        this.prisma.eventLog.count({
          where: { event: 'incident.postmortem.published', createdAt: dateFilter },
        }),
        this.prisma.eventLog.findMany({
          where: { event: { startsWith: 'incident.' }, createdAt: dateFilter },
          select: { id: true, event: true, payload: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    const resolutionRate =
      totalIncidents > 0
        ? parseFloat(((resolvedIncidents / totalIncidents) * 100).toFixed(2))
        : null;

    // Average time from incident.created to incident.resolved
    const responseTimeMetrics = await this.prisma.$queryRaw<
      Array<{ avg_response_minutes: number | null }>
    >`
      SELECT
        AVG(
          EXTRACT(EPOCH FROM (resolved.created_at - opened.created_at)) / 60
        ) AS avg_response_minutes
      FROM event_logs opened
      INNER JOIN event_logs resolved
        ON resolved.payload->>'incidentId' = opened.payload->>'incidentId'
        AND resolved.event = 'incident.resolved'
      WHERE
        opened.event = 'incident.created'
        AND opened.created_at BETWEEN ${from} AND ${to}
    `;

    const avgResponseMinutes =
      Array.isArray(responseTimeMetrics) && responseTimeMetrics.length > 0
        ? responseTimeMetrics[0]?.avg_response_minutes
        : null;

    const status: EvidenceControl['status'] =
      totalIncidents === 0
        ? 'satisfied' // No incidents = positive evidence, not a gap
        : resolutionRate !== null && resolutionRate >= 90
        ? 'satisfied'
        : 'partial';

    return {
      controlId: 'A.16.1',
      title: 'Incident Management',
      evidenceType: 'log',
      evidenceCount: totalIncidents,
      sampleEvidence: [
        {
          totalIncidents,
          resolvedIncidents,
          postIncidentReviews,
          resolutionRatePct: resolutionRate,
          avgResponseMinutes:
            avgResponseMinutes !== null
              ? parseFloat(Number(avgResponseMinutes).toFixed(2))
              : null,
        },
        ...sample,
      ],
      status,
      gapDescription:
        status === 'partial'
          ? `Incident resolution rate is ${resolutionRate}%. Some incidents may not have been formally closed in the system.`
          : undefined,
    };
  }

  /**
   * A.14.2 — Change Control Procedures
   * Evidence: deployment.* events (representing gated CI/CD changes).
   */
  private async a142ChangeControl(from: Date, to: Date): Promise<EvidenceControl> {
    const dateFilter = { gte: from, lte: to };

    const [totalChanges, gatedChanges, emergencyChanges, rollbacks, sample] =
      await Promise.all([
        this.prisma.eventLog.count({
          where: { event: { startsWith: 'deployment.' }, createdAt: dateFilter },
        }),
        // Gated changes: those that passed CI gates (deployment.gate.passed)
        this.prisma.eventLog.count({
          where: { event: 'deployment.gate.passed', createdAt: dateFilter },
        }),
        // Emergency changes bypass normal gates
        this.prisma.eventLog.count({
          where: {
            event: { startsWith: 'deployment.' },
            payload: { path: ['emergency'], equals: true },
            createdAt: dateFilter,
          },
        }),
        this.prisma.eventLog.count({
          where: { event: 'deployment.rollback', createdAt: dateFilter },
        }),
        this.prisma.eventLog.findMany({
          where: { event: { startsWith: 'deployment.' }, createdAt: dateFilter },
          select: { id: true, event: true, payload: true, createdAt: true, actorType: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    const gateCompliancePct =
      totalChanges > 0
        ? parseFloat(((gatedChanges / totalChanges) * 100).toFixed(2))
        : null;

    const status: EvidenceControl['status'] =
      totalChanges > 0 && (gateCompliancePct === null || gateCompliancePct >= 90)
        ? 'satisfied'
        : totalChanges > 0
        ? 'partial'
        : 'gap';

    return {
      controlId: 'A.14.2',
      title: 'Change Control Procedures',
      evidenceType: 'log',
      evidenceCount: totalChanges,
      sampleEvidence: [
        {
          totalChanges,
          gatedChanges,
          emergencyChanges,
          rollbacks,
          gateCompliancePct,
        },
        ...sample,
      ],
      status,
      gapDescription:
        status === 'gap'
          ? 'No deployment events in period. Ensure CI/CD pipeline publishes deployment.* events to EventLog.'
          : status === 'partial'
          ? `Gate compliance rate is ${gateCompliancePct}%. Some deployments may have bypassed CI gates.`
          : undefined,
    };
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  private buildSummary(controls: EvidenceControl[]): EvidencePackage['summary'] {
    const satisfied = controls.filter((c) => c.status === 'satisfied').length;
    const partial = controls.filter((c) => c.status === 'partial').length;
    const gaps = controls.filter((c) => c.status === 'gap').length;

    // Score formula: satisfied=100pts, partial=50pts, gap=0pts
    const overallScore =
      controls.length > 0
        ? Math.round(((satisfied * 100 + partial * 50) / (controls.length * 100)) * 100)
        : 0;

    return {
      totalControls: controls.length,
      satisfied,
      partial,
      gaps,
      overallScore,
    };
  }
}
