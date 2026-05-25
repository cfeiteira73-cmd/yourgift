#!/usr/bin/env tsx
/**
 * YourGift OS — Admin MFA Enrollment
 * Usage: tsx scripts/mfa-enroll.ts [admin-email]
 *
 * Steps:
 *   1. POST /admin/auth/mfa/setup     → { secret, qrUri }
 *   2. Print secret + QR URI prominently for authenticator app setup
 *   3. Prompt for 6-digit TOTP code
 *   4. POST /admin/auth/mfa/enable    → { backupCodes }
 *   5. Print backup codes with secure-storage warning
 */

import * as readline from 'node:readline';
import { createHmac } from 'node:crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_URL = process.env.YOURGIFT_API_URL ?? 'http://localhost:3001';
const ADMIN_TOKEN = process.env.YOURGIFT_ADMIN_TOKEN;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MfaSetupResponse {
  secret: string;
  qrUri: string;          // otpauth://totp/...
  issuer: string;
  accountName: string;
  algorithm: string;      // SHA1 | SHA256
  digits: number;
  periodSeconds: number;
}

interface MfaEnableResponse {
  enabled: boolean;
  backupCodes: string[];
  enabledAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function printUsage(): void {
  console.log(`
  YourGift OS — Admin MFA Enrollment
  ────────────────────────────────────────────────────────

  Usage:
    tsx scripts/mfa-enroll.ts [admin-email]

  Arguments:
    admin-email    Admin email address to enroll MFA for.
                   If omitted, uses the token's own identity.

  Environment variables required:
    YOURGIFT_ADMIN_TOKEN   Admin JWT token for authentication
    YOURGIFT_API_URL       API base URL (default: http://localhost:3001)

  Example:
    tsx scripts/mfa-enroll.ts admin@yourgift.pt
  `);
}

function generateSignature(payload: string, token: string): string {
  return createHmac('sha256', token).update(payload).digest('hex');
}

/**
 * Render a basic ASCII box-drawing QR code placeholder.
 * Full QR rendering would require qrcode-terminal or similar package.
 * This implementation prints a visually prominent frame around the URI
 * with clear instructions for users who cannot install extra packages.
 */
function printQrBlock(qrUri: string, secret: string): void {
  const width = 64;
  const border = '█'.repeat(width);
  const innerPad = (text: string): string => {
    const maxContent = width - 4; // 2 border + 2 space padding per side
    const truncated = text.length > maxContent ? text.slice(0, maxContent - 3) + '...' : text;
    const pad = maxContent - truncated.length;
    const leftPad = Math.floor(pad / 2);
    const rightPad = pad - leftPad;
    return `██ ${' '.repeat(leftPad)}${truncated}${' '.repeat(rightPad)} ██`;
  };
  const emptyRow = `██${' '.repeat(width - 4)}██`;

  console.log('\n' + colorize(border, 'cyan'));
  console.log(colorize(emptyRow, 'cyan'));
  console.log(colorize(innerPad('SCAN WITH AUTHENTICATOR APP'), 'cyan'));
  console.log(colorize(emptyRow, 'cyan'));
  console.log(colorize(innerPad('OR manually enter the secret below'), 'cyan'));
  console.log(colorize(emptyRow, 'cyan'));
  console.log(colorize(border, 'cyan'));

  console.log('\n' + colorize('  Manual Entry Secret (base32):', 'bold'));
  console.log('  ' + colorize('┌' + '─'.repeat(secret.length + 2) + '┐', 'cyan'));
  console.log('  ' + colorize('│ ', 'cyan') + colorize(secret, 'bold') + colorize(' │', 'cyan'));
  console.log('  ' + colorize('└' + '─'.repeat(secret.length + 2) + '┘', 'cyan'));

  console.log('\n' + colorize('  OTP Auth URI (copy into authenticator):', 'bold'));
  console.log(colorize(`  ${qrUri}`, 'yellow'));

  console.log('\n' + colorize('  Instructions:', 'bold'));
  console.log('  1. Open Google Authenticator, Authy, 1Password, or compatible TOTP app');
  console.log('  2. Choose "Add account" → "Enter setup key manually"');
  console.log(`  3. Enter secret: ${colorize(secret, 'bold')}`);
  console.log('  4. Select "Time-based" (TOTP)');
  console.log('  5. The app will display a 6-digit code that changes every 30s');
  console.log('');
}

function promptLine(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function validateTotp(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function printBackupCodes(codes: string[]): void {
  console.log('\n' + colorize('━'.repeat(60), 'bold'));
  console.log(colorize('  BACKUP CODES — STORE SECURELY', 'bold'));
  console.log(colorize('━'.repeat(60), 'bold'));
  console.log(colorize('\n  ⚠  WARNING: These codes are shown ONCE and cannot be recovered.', 'red'));
  console.log(colorize('  Store them in a password manager or print and keep in a secure location.\n', 'yellow'));
  console.log('  Each code can be used ONCE to bypass MFA if you lose your authenticator.\n');
  console.log(colorize('  ' + '─'.repeat(30), 'cyan'));

  for (let i = 0; i < codes.length; i++) {
    const num = String(i + 1).padStart(2, ' ');
    console.log(`  ${colorize(`${num}.`, 'cyan')} ${colorize(codes[i]!, 'bold')}`);
  }

  console.log(colorize('  ' + '─'.repeat(30), 'cyan'));
  console.log('\n' + colorize('  Do NOT share these codes with anyone.', 'red'));
  console.log(colorize('  Regenerate them via /admin/auth/mfa/backup-codes if compromised.\n', 'yellow'));
  console.log(colorize('━'.repeat(60), 'bold') + '\n');
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<Record<string, string>> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ADMIN_TOKEN}`,
    'X-Client': 'mfa-enroll-cli/1.0',
  };
}

async function setupMfa(email?: string): Promise<MfaSetupResponse> {
  const body: Record<string, string> = {
    requestedAt: new Date().toISOString(),
  };
  if (email) body['email'] = email;

  const res = await fetch(`${API_URL}/admin/auth/mfa/setup`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`MFA setup failed (HTTP ${res.status}): ${errorBody}`);
  }

  return res.json() as Promise<MfaSetupResponse>;
}

async function enableMfa(totpCode: string, email?: string): Promise<MfaEnableResponse> {
  const requestedAt = new Date().toISOString();
  const payloadBody = JSON.stringify({ totpCode, requestedAt });
  const signature = generateSignature(payloadBody, ADMIN_TOKEN!);

  const body: Record<string, string> = {
    totpCode,
    requestedAt,
    signature,
  };
  if (email) body['email'] = email;

  const res = await fetch(`${API_URL}/admin/auth/mfa/enable`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`MFA enable failed (HTTP ${res.status}): ${errorBody}`);
  }

  return res.json() as Promise<MfaEnableResponse>;
}

// ---------------------------------------------------------------------------
// Core enrollment flow
// ---------------------------------------------------------------------------

async function enrollMfa(email?: string): Promise<void> {
  console.log('\n' + colorize('━'.repeat(60), 'bold'));
  console.log(colorize('  YourGift OS — Admin MFA Enrollment', 'bold'));
  console.log(colorize('━'.repeat(60), 'bold'));
  if (email) {
    console.log(`  Enrolling : ${colorize(email, 'cyan')}`);
  }
  console.log(`  API URL   : ${API_URL}`);
  console.log(colorize('━'.repeat(60), 'bold') + '\n');

  // Step 1: Request MFA setup
  console.log(`  ${colorize('Step 1/3', 'cyan')} Requesting MFA setup from API...`);

  let setup: MfaSetupResponse;
  try {
    setup = await setupMfa(email);
  } catch (err) {
    console.error(colorize(`\n  [ERROR] ${String(err)}`, 'red'));
    process.exit(1);
  }

  console.log(`  ${colorize('✓', 'green')} MFA setup received.`);
  console.log(`  Issuer    : ${setup.issuer}`);
  console.log(`  Account   : ${setup.accountName}`);
  console.log(`  Algorithm : ${setup.algorithm}`);
  console.log(`  Digits    : ${setup.digits}`);
  console.log(`  Period    : ${setup.periodSeconds}s`);

  // Step 2: Display QR / secret
  console.log(`\n  ${colorize('Step 2/3', 'cyan')} Scan QR or enter secret in your authenticator app:`);
  printQrBlock(setup.qrUri, setup.secret);

  // Step 3: Prompt for TOTP code
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let totpCode = '';
  let attempts = 0;
  const MAX_ATTEMPTS = 3;

  console.log(`  ${colorize('Step 3/3', 'cyan')} Enter the 6-digit code from your authenticator app.\n`);

  while (attempts < MAX_ATTEMPTS) {
    const raw = await promptLine(rl, `  ${colorize('→', 'cyan')} Enter 6-digit TOTP code: `);

    if (!validateTotp(raw)) {
      attempts++;
      const remaining = MAX_ATTEMPTS - attempts;
      console.log(colorize(`  [ERROR] Invalid code format. Must be exactly 6 digits. (${remaining} attempt${remaining !== 1 ? 's' : ''} remaining)`, 'red'));
      if (attempts >= MAX_ATTEMPTS) {
        rl.close();
        console.error(colorize('\n  [ERROR] Maximum attempts reached. Run the script again to retry.\n', 'red'));
        process.exit(1);
      }
      continue;
    }

    totpCode = raw;
    break;
  }

  rl.close();

  // Step 4: Enable MFA
  console.log(`\n  ${colorize('→', 'cyan')} Verifying TOTP code and enabling MFA...`);

  let enableResponse: MfaEnableResponse;
  try {
    enableResponse = await enableMfa(totpCode, email);
  } catch (err) {
    const errMsg = String(err);
    if (errMsg.includes('401') || errMsg.includes('invalid') || errMsg.includes('expired')) {
      console.error(colorize('\n  [ERROR] TOTP code was incorrect or expired. Run the script again with a fresh code.\n', 'red'));
    } else {
      console.error(colorize(`\n  [ERROR] ${errMsg}\n`, 'red'));
    }
    process.exit(1);
  }

  if (!enableResponse.enabled) {
    console.error(colorize('\n  [ERROR] API returned enabled=false. Check server logs.\n', 'red'));
    process.exit(1);
  }

  console.log(colorize(`\n  ${colorize('✓', 'green')} MFA enabled successfully at ${enableResponse.enabledAt}`, 'green'));

  // Step 5: Print backup codes
  printBackupCodes(enableResponse.backupCodes);

  console.log(colorize('  MFA enrollment complete. ✓', 'green'));
  console.log('  From now on, login will require your authenticator app code.\n');
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

  const email = args[0]; // Optional

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(colorize(`\n  [ERROR] Invalid email address: "${email}"\n`, 'red'));
    process.exit(1);
  }

  if (!ADMIN_TOKEN) {
    console.error(colorize('\n  [ERROR] YOURGIFT_ADMIN_TOKEN is not set.\n', 'red'));
    console.error('  Generate a token first:');
    console.error(`    curl -X POST ${API_URL}/admin/auth/login \\`);
    console.error(`         -H "Content-Type: application/json" \\`);
    console.error(`         -d \'{"email":"admin@yourgift.pt","password":"<password>"}\' | jq .accessToken`);
    console.error('');
    console.error('    export YOURGIFT_ADMIN_TOKEN=<token>');
    console.error('');
    process.exit(1);
  }

  await enrollMfa(email);
}

main().catch((err) => {
  console.error(colorize(`\n  [FATAL] Unhandled error: ${String(err)}\n`, 'red'));
  process.exit(1);
});
