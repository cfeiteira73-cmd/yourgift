#!/usr/bin/env tsx
/**
 * YourGift OS — Chaos Drill Executor
 * Usage: tsx scripts/chaos-drill.ts [drill-type] [duration-seconds]
 * Example: tsx scripts/chaos-drill.ts latency_injection 30
 *
 * Drill types:
 *   redis_outage         Simulate Redis unavailability
 *   db_failover          Simulate primary DB failover
 *   stripe_timeout       Simulate Stripe API timeouts
 *   queue_corruption     Inject corrupt messages into BullMQ queues
 *   memory_pressure      Simulate memory pressure / OOM approach
 *   latency_injection    Add artificial latency to all requests (default)
 */

import { createHmac } from 'node:crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_URL = process.env.YOURGIFT_API_URL ?? 'http://localhost:3001';
const ADMIN_TOKEN = process.env.YOURGIFT_ADMIN_TOKEN;

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1_000; // 10 min safety ceiling

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DrillType =
  | 'redis_outage'
  | 'db_failover'
  | 'stripe_timeout'
  | 'queue_corruption'
  | 'memory_pressure'
  | 'latency_injection';

type DrillStatus = 'pending' | 'running' | 'completed' | 'aborted' | 'failed';

interface DrillPayload {
  drillType: DrillType;
  durationSeconds: number;
  requestedAt: string;
  requestedBy: string;
  signature: string;
}

interface DrillCreateResponse {
  id: string;
  drillType: DrillType;
  status: DrillStatus;
  startedAt: string;
  estimatedCompletionAt: string;
  message?: string;
}

interface Finding {
  severity: 'info' | 'warning' | 'critical';
  component: string;
  description: string;
  recommendation?: string;
}

interface DrillResult {
  id: string;
  drillType: DrillType;
  status: DrillStatus;
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  mttrMinutes?: number;
  rtoMet?: boolean;
  rpoMet?: boolean;
  rtoTargetSeconds?: number;
  rpoTargetSeconds?: number;
  rtoActualSeconds?: number;
  rpoActualSeconds?: number;
  errorRate?: number;
  p99LatencyMs?: number;
  findings: Finding[];
  abortReason?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_DRILL_TYPES: DrillType[] = [
  'redis_outage',
  'db_failover',
  'stripe_timeout',
  'queue_corruption',
  'memory_pressure',
  'latency_injection',
];

function isValidDrillType(value: string): value is DrillType {
  return VALID_DRILL_TYPES.includes(value as DrillType);
}

function printUsage(): void {
  console.log(`
  YourGift OS — Chaos Drill Executor
  ────────────────────────────────────────────────────────

  Usage:
    tsx scripts/chaos-drill.ts [drill-type] [duration-seconds]

  Arguments:
    drill-type          One of: ${VALID_DRILL_TYPES.join(' | ')}
                        Default: latency_injection
    duration-seconds    Drill duration (10–300). Default: 30

  Environment variables required:
    YOURGIFT_ADMIN_TOKEN   Long-lived admin JWT token
    YOURGIFT_API_URL       API base URL (default: http://localhost:3001)

  Examples:
    tsx scripts/chaos-drill.ts latency_injection 30
    tsx scripts/chaos-drill.ts redis_outage 60
    tsx scripts/chaos-drill.ts db_failover 120
  `);
}

function generateSignature(payload: string, token: string): string {
  return createHmac('sha256', token).update(payload).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function colorize(text: string, color: 'green' | 'yellow' | 'red' | 'cyan' | 'bold' | 'reset'): string {
  const codes: Record<string, string> = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    reset: '\x1b[0m',
  };
  return `${codes[color]}${text}${codes.reset}`;
}

function statusIcon(status: DrillStatus): string {
  switch (status) {
    case 'pending': return '⏳';
    case 'running': return '🔥';
    case 'completed': return '✅';
    case 'aborted': return '⛔';
    case 'failed': return '❌';
    default: return '?';
  }
}

function severityColor(severity: Finding['severity']): (text: string) => string {
  switch (severity) {
    case 'critical': return (t) => colorize(t, 'red');
    case 'warning': return (t) => colorize(t, 'yellow');
    case 'info': return (t) => colorize(t, 'cyan');
  }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<Record<string, string>> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    'X-Client': 'chaos-drill-cli/1.0',
  };
}

async function startDrill(drillType: DrillType, durationSeconds: number): Promise<DrillCreateResponse> {
  const requestedAt = new Date().toISOString();
  const payloadBody = JSON.stringify({ drillType, durationSeconds, requestedAt });
  const signature = generateSignature(payloadBody, ADMIN_TOKEN!);

  const payload: DrillPayload = {
    drillType,
    durationSeconds,
    requestedAt,
    requestedBy: 'chaos-drill-cli',
    signature,
  };

  const res = await fetch(`${API_URL}/admin/chaos/drills`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to start drill (HTTP ${res.status}): ${errorBody}`);
  }

  return res.json() as Promise<DrillCreateResponse>;
}

async function getDrillStatus(drillId: string): Promise<DrillResult> {
  const res = await fetch(`${API_URL}/admin/chaos/drills/${drillId}`, {
    headers: await authHeaders(),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to poll drill status (HTTP ${res.status}): ${errorBody}`);
  }

  return res.json() as Promise<DrillResult>;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printDrillHeader(drillType: DrillType, durationSeconds: number, drillId: string): void {
  console.log('\n' + colorize('━'.repeat(60), 'bold'));
  console.log(colorize('  YourGift OS — Chaos Drill Executor', 'bold'));
  console.log(colorize('━'.repeat(60), 'bold'));
  console.log(`  Drill Type : ${colorize(drillType, 'cyan')}`);
  console.log(`  Duration   : ${colorize(`${durationSeconds}s`, 'cyan')}`);
  console.log(`  Drill ID   : ${colorize(drillId, 'cyan')}`);
  console.log(`  API URL    : ${API_URL}`);
  console.log(`  Started At : ${new Date().toISOString()}`);
  console.log(colorize('━'.repeat(60), 'bold') + '\n');
}

function printStatusLine(result: DrillResult, elapsedMs: number): void {
  const icon = statusIcon(result.status);
  const elapsed = formatDuration(elapsedMs);
  const p99 = result.p99LatencyMs != null ? `p99=${result.p99LatencyMs}ms` : '';
  const errRate = result.errorRate != null ? `err=${(result.errorRate * 100).toFixed(1)}%` : '';
  const metrics = [p99, errRate].filter(Boolean).join(' ');

  process.stdout.write(
    `\r  ${icon} ${colorize(result.status.toUpperCase(), 'bold')} ` +
    `[${elapsed}] ` +
    (metrics ? colorize(`(${metrics})`, 'yellow') : '') +
    '     ',
  );
}

function printFinalReport(result: DrillResult, elapsedMs: number): void {
  console.log('\n\n' + colorize('━'.repeat(60), 'bold'));
  console.log(colorize('  Drill Completed — Final Report', 'bold'));
  console.log(colorize('━'.repeat(60), 'bold'));

  const ok = (v: boolean | undefined) =>
    v == null ? colorize('N/A', 'yellow') : v ? colorize('MET ✓', 'green') : colorize('MISSED ✗', 'red');

  console.log(`  Status     : ${statusIcon(result.status)} ${colorize(result.status.toUpperCase(), result.status === 'completed' ? 'green' : 'red')}`);
  console.log(`  Drill ID   : ${result.id}`);
  console.log(`  Drill Type : ${result.drillType}`);
  console.log(`  Started At : ${result.startedAt}`);
  console.log(`  Ended At   : ${result.completedAt ?? 'N/A'}`);
  console.log(`  Wall Time  : ${formatDuration(elapsedMs)}`);

  if (result.abortReason) {
    console.log(`  Abort Reason : ${colorize(result.abortReason, 'red')}`);
  }

  console.log('\n' + colorize('  Recovery Metrics', 'bold'));
  console.log('  ' + '─'.repeat(40));

  if (result.mttrMinutes != null) {
    const mttrColor = result.mttrMinutes < 2 ? 'green' : result.mttrMinutes < 5 ? 'yellow' : 'red';
    console.log(`  MTTR         : ${colorize(`${result.mttrMinutes.toFixed(2)} min`, mttrColor)}`);
  }

  console.log(`  RTO Target   : ${result.rtoTargetSeconds != null ? `${result.rtoTargetSeconds}s` : 'N/A'}`);
  console.log(`  RTO Actual   : ${result.rtoActualSeconds != null ? `${result.rtoActualSeconds}s` : 'N/A'}`);
  console.log(`  RTO Status   : ${ok(result.rtoMet)}`);
  console.log(`  RPO Target   : ${result.rpoTargetSeconds != null ? `${result.rpoTargetSeconds}s` : 'N/A'}`);
  console.log(`  RPO Actual   : ${result.rpoActualSeconds != null ? `${result.rpoActualSeconds}s` : 'N/A'}`);
  console.log(`  RPO Status   : ${ok(result.rpoMet)}`);

  if (result.p99LatencyMs != null) {
    console.log(`  p99 Latency  : ${result.p99LatencyMs}ms`);
  }
  if (result.errorRate != null) {
    const errColor = result.errorRate < 0.01 ? 'green' : result.errorRate < 0.05 ? 'yellow' : 'red';
    console.log(`  Error Rate   : ${colorize(`${(result.errorRate * 100).toFixed(2)}%`, errColor)}`);
  }

  if (result.findings.length > 0) {
    console.log('\n' + colorize('  Findings', 'bold'));
    console.log('  ' + '─'.repeat(40));

    for (const finding of result.findings) {
      const colorFn = severityColor(finding.severity);
      console.log(`\n  ${colorFn(`[${finding.severity.toUpperCase()}]`)} ${colorize(finding.component, 'bold')}`);
      console.log(`    ${finding.description}`);
      if (finding.recommendation) {
        console.log(`    ${colorize('→ Recommendation:', 'cyan')} ${finding.recommendation}`);
      }
    }
  } else {
    console.log('\n  ' + colorize('No findings recorded.', 'green'));
  }

  console.log('\n' + colorize('━'.repeat(60), 'bold') + '\n');
}

// ---------------------------------------------------------------------------
// Core drill runner
// ---------------------------------------------------------------------------

async function runDrill(drillType: DrillType, durationSeconds: number): Promise<void> {
  console.log(`\n  ${colorize('→', 'cyan')} Starting chaos drill: ${colorize(drillType, 'bold')} (${durationSeconds}s)...`);

  let createResponse: DrillCreateResponse;
  try {
    createResponse = await startDrill(drillType, durationSeconds);
  } catch (err) {
    console.error(colorize(`\n  [ERROR] Could not start drill: ${String(err)}`, 'red'));
    process.exit(1);
  }

  printDrillHeader(drillType, durationSeconds, createResponse.id);
  console.log(`  ${colorize('✓', 'green')} Drill initiated. Polling for status...\n`);

  const startMs = Date.now();
  let lastStatus: DrillStatus = createResponse.status;
  let result: DrillResult | null = null;

  while (Date.now() - startMs < MAX_POLL_DURATION_MS) {
    await sleep(POLL_INTERVAL_MS);

    let polled: DrillResult;
    try {
      polled = await getDrillStatus(createResponse.id);
    } catch (err) {
      process.stdout.write('\n');
      console.error(colorize(`  [WARN] Poll failed: ${String(err)} — retrying...`, 'yellow'));
      continue;
    }

    const elapsedMs = Date.now() - startMs;
    printStatusLine(polled, elapsedMs);

    if (polled.status !== lastStatus) {
      process.stdout.write('\n');
      console.log(`  ${colorize('→', 'cyan')} Status changed: ${lastStatus} → ${colorize(polled.status, 'bold')}`);
      lastStatus = polled.status;
    }

    if (polled.status === 'completed' || polled.status === 'aborted' || polled.status === 'failed') {
      result = polled;
      break;
    }
  }

  if (!result) {
    process.stdout.write('\n');
    console.error(colorize('\n  [ERROR] Polling timed out (10 min ceiling reached). Check API logs.', 'red'));
    process.exit(1);
  }

  printFinalReport(result, Date.now() - startMs);

  if (result.status === 'completed') {
    const allObjectivesMet = result.rtoMet !== false && result.rpoMet !== false;
    if (allObjectivesMet) {
      console.log(colorize('  All objectives met. System is resilient. ✓\n', 'green'));
    } else {
      console.log(colorize('  Some objectives not met. Review findings and recommendations.\n', 'yellow'));
    }
    process.exit(0);
  } else {
    console.log(colorize(`  Drill ${result.status}. Check findings above.\n`, 'red'));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Help flag
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Drill type
  const rawDrillType = args[0] ?? 'latency_injection';
  if (!isValidDrillType(rawDrillType)) {
    console.error(colorize(`\n  [ERROR] Unknown drill type: "${rawDrillType}"`, 'red'));
    console.error(`  Valid types: ${VALID_DRILL_TYPES.join(', ')}\n`);
    process.exit(1);
  }
  const drillType: DrillType = rawDrillType;

  // Duration
  const rawDuration = args[1] ?? '30';
  const durationSeconds = parseInt(rawDuration, 10);
  if (isNaN(durationSeconds) || durationSeconds < 10 || durationSeconds > 300) {
    console.error(colorize(`\n  [ERROR] Invalid duration: "${rawDuration}". Must be 10–300 seconds.\n`, 'red'));
    process.exit(1);
  }

  // Auth check
  if (!ADMIN_TOKEN) {
    console.error(colorize('\n  [ERROR] YOURGIFT_ADMIN_TOKEN is not set.\n', 'red'));
    console.error('  To obtain a token:');
    console.error('    1. Authenticate to the admin API:');
    console.error(`       curl -X POST ${API_URL}/admin/auth/login -H "Content-Type: application/json" \\`);
    console.error(`            -d \'{"email":"admin@yourgift.pt","password":"<password>"}\' | jq .accessToken`);
    console.error('');
    console.error('    2. Export it:');
    console.error('       export YOURGIFT_ADMIN_TOKEN=<token>');
    console.error('');
    console.error('    3. Re-run this script.');
    console.error('');
    process.exit(1);
  }

  await runDrill(drillType, durationSeconds);
}

main().catch((err) => {
  console.error(colorize(`\n  [FATAL] Unhandled error: ${String(err)}\n`, 'red'));
  process.exit(1);
});
