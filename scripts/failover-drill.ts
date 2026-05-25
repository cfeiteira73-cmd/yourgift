#!/usr/bin/env tsx
/**
 * YourGift OS — Failover Drill Executor
 * Usage: tsx scripts/failover-drill.ts [drill-type]
 * Example: tsx scripts/failover-drill.ts db_primary_failover
 *
 * Drill types:
 *   db_primary_failover      Simulate RDS primary failover to replica
 *   redis_primary_failover   Simulate ElastiCache primary failover to replica
 *   full_region_isolation    Simulate full AWS region isolation
 */

import { createHmac } from 'node:crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_URL = process.env.YOURGIFT_API_URL ?? 'http://localhost:3001';
const ADMIN_TOKEN = process.env.YOURGIFT_ADMIN_TOKEN;

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_DURATION_MS = 15 * 60 * 1_000; // 15 min — failovers take longer

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FailoverDrillType =
  | 'db_primary_failover'
  | 'redis_primary_failover'
  | 'full_region_isolation';

type DrillPhase =
  | 'preparing'
  | 'triggering_failover'
  | 'awaiting_promotion'
  | 'validating_connectivity'
  | 'verifying_data_integrity'
  | 'completing'
  | 'completed'
  | 'aborted'
  | 'failed';

interface FailoverDrillCreateResponse {
  id: string;
  drillType: FailoverDrillType;
  phase: DrillPhase;
  startedAt: string;
  estimatedRtoSeconds: number;
  estimatedRpoSeconds: number;
  message?: string;
}

interface ObjectiveResult {
  targetSeconds: number;
  actualSeconds?: number;
  met?: boolean;
  notes?: string;
}

interface FailoverEvent {
  timestamp: string;
  phase: DrillPhase;
  description: string;
  durationMs?: number;
}

interface FailoverDrillResult {
  id: string;
  drillType: FailoverDrillType;
  phase: DrillPhase;
  startedAt: string;
  completedAt?: string;
  rto: ObjectiveResult;
  rpo: ObjectiveResult;
  dataLossBytes?: number;
  connectionsDropped?: number;
  connectionsRestored?: number;
  errorsDuringFailover?: number;
  timeline: FailoverEvent[];
  abortReason?: string;
  certificationPassed?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_DRILL_TYPES: FailoverDrillType[] = [
  'db_primary_failover',
  'redis_primary_failover',
  'full_region_isolation',
];

function isValidDrillType(value: string): value is FailoverDrillType {
  return VALID_DRILL_TYPES.includes(value as FailoverDrillType);
}

function printUsage(): void {
  console.log(`
  YourGift OS — Failover Drill Executor
  ────────────────────────────────────────────────────────

  Usage:
    tsx scripts/failover-drill.ts [drill-type]

  Arguments:
    drill-type    One of:
                  db_primary_failover      — RDS primary→replica promotion
                  redis_primary_failover   — ElastiCache failover
                  full_region_isolation    — Full region isolation test
                  Default: db_primary_failover

  Environment variables required:
    YOURGIFT_ADMIN_TOKEN   Long-lived admin JWT token
    YOURGIFT_API_URL       API base URL (default: http://localhost:3001)

  WARNING: These drills cause real failovers. Run during maintenance windows.

  Examples:
    tsx scripts/failover-drill.ts db_primary_failover
    tsx scripts/failover-drill.ts redis_primary_failover
    tsx scripts/failover-drill.ts full_region_isolation
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

function colorize(text: string, color: 'green' | 'yellow' | 'red' | 'cyan' | 'bold' | 'magenta' | 'reset'): string {
  const codes: Record<string, string> = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    magenta: '\x1b[35m',
    reset: '\x1b[0m',
  };
  return `${codes[color]}${text}${codes.reset}`;
}

function phaseIcon(phase: DrillPhase): string {
  switch (phase) {
    case 'preparing': return '🔧';
    case 'triggering_failover': return '⚡';
    case 'awaiting_promotion': return '⏳';
    case 'validating_connectivity': return '🔍';
    case 'verifying_data_integrity': return '🔎';
    case 'completing': return '✨';
    case 'completed': return '✅';
    case 'aborted': return '⛔';
    case 'failed': return '❌';
    default: return '?';
  }
}

function formatObjective(label: string, obj: ObjectiveResult): string {
  const actual = obj.actualSeconds != null ? `${obj.actualSeconds}s actual` : 'pending';
  const target = `${obj.targetSeconds}s target`;
  const status =
    obj.met == null
      ? colorize('PENDING', 'yellow')
      : obj.met
        ? colorize('MET ✓', 'green')
        : colorize('MISSED ✗', 'red');
  return `  ${label.padEnd(14)}: ${status} (${target} / ${actual})${obj.notes ? ` — ${obj.notes}` : ''}`;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<Record<string, string>> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    'X-Client': 'failover-drill-cli/1.0',
  };
}

async function startFailoverDrill(drillType: FailoverDrillType): Promise<FailoverDrillCreateResponse> {
  const requestedAt = new Date().toISOString();
  const payloadBody = JSON.stringify({ drillType, requestedAt });
  const signature = generateSignature(payloadBody, ADMIN_TOKEN!);

  const res = await fetch(`${API_URL}/admin/chaos/failover-drill/${drillType}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ requestedAt, requestedBy: 'failover-drill-cli', signature }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to start failover drill (HTTP ${res.status}): ${errorBody}`);
  }

  return res.json() as Promise<FailoverDrillCreateResponse>;
}

async function getFailoverDrillStatus(drillId: string): Promise<FailoverDrillResult> {
  const res = await fetch(`${API_URL}/admin/chaos/failover-drill/${drillId}/status`, {
    headers: await authHeaders(),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to poll failover drill status (HTTP ${res.status}): ${errorBody}`);
  }

  return res.json() as Promise<FailoverDrillResult>;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printDrillHeader(drillType: FailoverDrillType, drillId: string, estimated: { rto: number; rpo: number }): void {
  console.log('\n' + colorize('━'.repeat(65), 'bold'));
  console.log(colorize('  YourGift OS — Failover Drill Executor', 'bold'));
  console.log(colorize('━'.repeat(65), 'bold'));
  console.log(`  Drill Type       : ${colorize(drillType, 'cyan')}`);
  console.log(`  Drill ID         : ${colorize(drillId, 'cyan')}`);
  console.log(`  API URL          : ${API_URL}`);
  console.log(`  RTO Target       : ${colorize(`${estimated.rto}s`, 'yellow')}`);
  console.log(`  RPO Target       : ${colorize(`${estimated.rpo}s`, 'yellow')}`);
  console.log(`  Started At       : ${new Date().toISOString()}`);
  console.log(colorize('  ⚠  WARNING: This drill triggers a real failover event.', 'red'));
  console.log(colorize('━'.repeat(65), 'bold') + '\n');
}

function printPhaseUpdate(phase: DrillPhase, elapsedMs: number): void {
  process.stdout.write(
    `\r  ${phaseIcon(phase)} ${colorize(phase.toUpperCase().replace(/_/g, ' '), 'bold')} ` +
    `[elapsed: ${formatDuration(elapsedMs)}]      `,
  );
}

function printTimeline(events: FailoverEvent[]): void {
  if (events.length === 0) return;

  console.log('\n' + colorize('  Failover Timeline', 'bold'));
  console.log('  ' + '─'.repeat(55));

  for (const event of events) {
    const ts = new Date(event.timestamp).toISOString().slice(11, 23); // HH:mm:ss.sss
    const durationStr = event.durationMs != null ? colorize(` (+${event.durationMs}ms)`, 'yellow') : '';
    console.log(`  ${colorize(ts, 'cyan')} ${phaseIcon(event.phase)} ${event.description}${durationStr}`);
  }
}

function printFinalReport(result: FailoverDrillResult, elapsedMs: number): void {
  console.log('\n\n' + colorize('━'.repeat(65), 'bold'));
  console.log(colorize('  Failover Drill — Final Report', 'bold'));
  console.log(colorize('━'.repeat(65), 'bold'));

  const isCompleted = result.phase === 'completed';
  console.log(`  Status         : ${phaseIcon(result.phase)} ${colorize(result.phase.toUpperCase(), isCompleted ? 'green' : 'red')}`);
  console.log(`  Drill ID       : ${result.id}`);
  console.log(`  Drill Type     : ${result.drillType}`);
  console.log(`  Started At     : ${result.startedAt}`);
  console.log(`  Completed At   : ${result.completedAt ?? 'N/A'}`);
  console.log(`  Wall Time      : ${formatDuration(elapsedMs)}`);

  if (result.abortReason) {
    console.log(`  Abort Reason   : ${colorize(result.abortReason, 'red')}`);
  }

  console.log('\n' + colorize('  Objectives', 'bold'));
  console.log('  ' + '─'.repeat(55));
  console.log(formatObjective('RTO', result.rto));
  console.log(formatObjective('RPO', result.rpo));

  console.log('\n' + colorize('  Metrics', 'bold'));
  console.log('  ' + '─'.repeat(55));

  if (result.dataLossBytes != null) {
    const dataLossColor = result.dataLossBytes === 0 ? 'green' : result.dataLossBytes < 1024 ? 'yellow' : 'red';
    console.log(`  Data Loss      : ${colorize(`${result.dataLossBytes} bytes`, dataLossColor)}`);
  }

  if (result.connectionsDropped != null) {
    console.log(`  Connections Dropped   : ${colorize(String(result.connectionsDropped), 'yellow')}`);
  }
  if (result.connectionsRestored != null) {
    const restoredPct =
      result.connectionsDropped != null && result.connectionsDropped > 0
        ? ` (${((result.connectionsRestored / result.connectionsDropped) * 100).toFixed(1)}% restored)`
        : '';
    console.log(`  Connections Restored  : ${colorize(String(result.connectionsRestored), 'green')}${restoredPct}`);
  }
  if (result.errorsDuringFailover != null) {
    const errColor = result.errorsDuringFailover === 0 ? 'green' : result.errorsDuringFailover < 10 ? 'yellow' : 'red';
    console.log(`  Errors During Failover: ${colorize(String(result.errorsDuringFailover), errColor)}`);
  }

  printTimeline(result.timeline ?? []);

  if (result.certificationPassed != null) {
    console.log('\n' + colorize('  Certification', 'bold'));
    console.log('  ' + '─'.repeat(55));
    const certStatus = result.certificationPassed
      ? colorize('  PASSED — System meets RTO/RPO requirements ✓', 'green')
      : colorize('  FAILED — System does not meet RTO/RPO requirements ✗', 'red');
    console.log(certStatus);
  }

  console.log('\n' + colorize('━'.repeat(65), 'bold') + '\n');
}

// ---------------------------------------------------------------------------
// Core failover drill runner
// ---------------------------------------------------------------------------

async function runFailoverDrill(drillType: FailoverDrillType): Promise<void> {
  console.log(`\n  ${colorize('→', 'cyan')} Initiating failover drill: ${colorize(drillType, 'bold')}...`);
  console.log(colorize('  ⚠  This will cause a real failover. Ensure this is a scheduled window.', 'yellow'));

  let createResponse: FailoverDrillCreateResponse;
  try {
    createResponse = await startFailoverDrill(drillType);
  } catch (err) {
    console.error(colorize(`\n  [ERROR] Could not start failover drill: ${String(err)}`, 'red'));
    process.exit(1);
  }

  printDrillHeader(drillType, createResponse.id, {
    rto: createResponse.estimatedRtoSeconds,
    rpo: createResponse.estimatedRpoSeconds,
  });

  console.log(`  ${colorize('✓', 'green')} Failover drill initiated. Polling for phase updates...\n`);

  const startMs = Date.now();
  let lastPhase: DrillPhase = createResponse.phase;
  let result: FailoverDrillResult | null = null;

  while (Date.now() - startMs < MAX_POLL_DURATION_MS) {
    await sleep(POLL_INTERVAL_MS);

    let polled: FailoverDrillResult;
    try {
      polled = await getFailoverDrillStatus(createResponse.id);
    } catch (err) {
      process.stdout.write('\n');
      console.error(colorize(`  [WARN] Poll failed: ${String(err)} — retrying...`, 'yellow'));
      continue;
    }

    const elapsedMs = Date.now() - startMs;
    printPhaseUpdate(polled.phase, elapsedMs);

    if (polled.phase !== lastPhase) {
      process.stdout.write('\n');
      console.log(
        `  ${colorize('→', 'cyan')} Phase: ${colorize(lastPhase, 'yellow')} → ${colorize(polled.phase, 'bold')} ` +
        `(${formatDuration(elapsedMs)})`,
      );
      lastPhase = polled.phase;
    }

    if (polled.phase === 'completed' || polled.phase === 'aborted' || polled.phase === 'failed') {
      result = polled;
      break;
    }
  }

  if (!result) {
    process.stdout.write('\n');
    console.error(colorize('\n  [ERROR] Polling timed out (15 min ceiling reached). Check API logs.', 'red'));
    process.exit(1);
  }

  printFinalReport(result, Date.now() - startMs);

  const success = result.phase === 'completed' && result.rto.met !== false && result.rpo.met !== false;

  if (success) {
    console.log(colorize('  Failover drill PASSED. RTO and RPO objectives met. ✓\n', 'green'));
    process.exit(0);
  } else if (result.phase === 'completed') {
    console.log(colorize('  Failover drill completed but some objectives were MISSED.\n', 'yellow'));
    process.exit(1);
  } else {
    console.log(colorize(`  Failover drill ${result.phase.toUpperCase()}.\n`, 'red'));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const rawDrillType = args[0] ?? 'db_primary_failover';
  if (!isValidDrillType(rawDrillType)) {
    console.error(colorize(`\n  [ERROR] Unknown drill type: "${rawDrillType}"`, 'red'));
    console.error(`  Valid types: ${VALID_DRILL_TYPES.join(', ')}\n`);
    process.exit(1);
  }
  const drillType: FailoverDrillType = rawDrillType;

  if (!ADMIN_TOKEN) {
    console.error(colorize('\n  [ERROR] YOURGIFT_ADMIN_TOKEN is not set.\n', 'red'));
    console.error('  To obtain a token:');
    console.error(`    curl -X POST ${API_URL}/admin/auth/login \\`);
    console.error(`         -H "Content-Type: application/json" \\`);
    console.error(`         -d \'{"email":"admin@yourgift.pt","password":"<password>"}\' | jq .accessToken`);
    console.error('');
    console.error('    export YOURGIFT_ADMIN_TOKEN=<token>');
    console.error('');
    process.exit(1);
  }

  await runFailoverDrill(drillType);
}

main().catch((err) => {
  console.error(colorize(`\n  [FATAL] Unhandled error: ${String(err)}\n`, 'red'));
  process.exit(1);
});
