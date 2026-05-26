import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';

@Injectable()
export class TotpService {
  /** Generate a random 20-byte base32 secret. */
  generateSecret(): string {
    const bytes = randomBytes(20);
    return this.base32Encode(bytes);
  }

  /** Build the otpauth:// URI used to generate QR codes. */
  getTotpUri(
    secret: string,
    account: string,
    issuer = 'YourGift OS Admin',
  ): string {
    return (
      `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
      `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
    );
  }

  /**
   * Validate a 6-digit TOTP code.
   * Checks the current 30-second window ±1 step to handle clock drift.
   */
  validateCode(secret: string, code: string): boolean {
    const normalised = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalised)) return false;

    const now = Math.floor(Date.now() / 1000);
    const step = 30;
    for (const delta of [-1, 0, 1]) {
      const counter = Math.floor((now + delta * step) / step);
      if (this.generateHotp(secret, counter) === normalised) return true;
    }
    return false;
  }

  // ─── private helpers ───────────────────────────────────────────────────────

  private generateHotp(secret: string, counter: number): string {
    const key = this.base32Decode(secret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(code % 1_000_000).padStart(6, '0');
  }

  private base32Encode(bytes: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;
    for (const byte of bytes) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) result += alphabet[(value << (5 - bits)) & 31];
    return result;
  }

  private base32Decode(str: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = str.toUpperCase().replace(/=+$/, '');
    const bytes: number[] = [];
    let bits = 0;
    let value = 0;
    for (const char of clean) {
      const idx = alphabet.indexOf(char);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }
}
