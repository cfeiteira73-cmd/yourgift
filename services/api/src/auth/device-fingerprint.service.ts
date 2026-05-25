import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface DeviceSignals {
  userAgent?: string;
  acceptLanguage?: string;
  platform?: string;
  screenResolution?: string;
  timezone?: string;
}

export interface DeviceRegistrationResult {
  isKnown: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  deviceSessionId: string;
}

export interface KnownDevice {
  id: string;
  deviceId: string;
  userAgent: string | null;
  ip: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}

@Injectable()
export class DeviceFingerprintService {
  private readonly logger = new Logger(DeviceFingerprintService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a deterministic device fingerprint from request signals.
   * SHA-256 over the concatenated signal string, returned as 16-char hex prefix.
   * Stable across sessions for the same device/browser configuration.
   */
  generateFingerprint(signals: DeviceSignals): string {
    const raw = [
      signals.userAgent ?? '',
      signals.acceptLanguage ?? '',
      signals.platform ?? '',
      signals.screenResolution ?? '',
      signals.timezone ?? '',
    ].join('|');

    return createHash('sha256').update(raw).digest('hex').slice(0, 16);
  }

  /**
   * Register a device session after successful login.
   * Upserts the DeviceSession record (keyed on clientId + deviceId).
   * Returns whether device was known and a risk level.
   */
  async registerDevice(
    clientId: string,
    fingerprint: string,
    signals: DeviceSignals,
    ipAddress: string,
  ): Promise<DeviceRegistrationResult> {
    // Check whether this fingerprint has been seen before for this client
    const existing = await this.prisma.deviceSession.findFirst({
      where: { clientId, deviceId: fingerprint },
    });

    const isKnown = !!existing;

    // Upsert using the compound unique key [clientId, deviceId]
    const session = await this.prisma.deviceSession.upsert({
      where: {
        clientId_deviceId: { clientId, deviceId: fingerprint },
      },
      create: {
        clientId,
        deviceId: fingerprint,
        userAgent: signals.userAgent ?? null,
        ip: ipAddress,
        lastSeenAt: new Date(),
      },
      update: {
        lastSeenAt: new Date(),
        ip: ipAddress,
        userAgent: signals.userAgent ?? undefined,
      },
    });

    // Risk level: known device = low; unknown but no bot signal = medium; bot UA = high
    let riskLevel: 'low' | 'medium' | 'high';
    if (isKnown) {
      riskLevel = 'low';
    } else if (
      signals.userAgent &&
      /bot|crawler|spider|scraper|headless/i.test(signals.userAgent)
    ) {
      riskLevel = 'high';
    } else {
      riskLevel = 'medium';
    }

    this.logger.log(
      `Device ${isKnown ? 'recognized' : 'new'} for client ${clientId}: fingerprint=${fingerprint} risk=${riskLevel}`,
    );

    return { isKnown, riskLevel, deviceSessionId: session.id };
  }

  /**
   * Get all known devices for a client.
   */
  async getKnownDevices(clientId: string): Promise<KnownDevice[]> {
    const sessions = await this.prisma.deviceSession.findMany({
      where: { clientId },
      orderBy: { lastSeenAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      userAgent: s.userAgent ?? null,
      ip: s.ip ?? null,
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Revoke a specific device session (logout all active sessions on that device).
   * Deletes the DeviceSession record and revokes all ActiveSession records for that device.
   */
  async revokeDevice(clientId: string, deviceSessionId: string): Promise<void> {
    // Find the session to get the deviceId
    const session = await this.prisma.deviceSession.findFirst({
      where: { id: deviceSessionId, clientId },
    });

    if (!session) {
      this.logger.warn(`Device session ${deviceSessionId} not found for client ${clientId}`);
      return;
    }

    // Revoke all active sessions associated with this deviceId
    await this.prisma.activeSession
      .updateMany({
        where: { clientId, deviceId: session.deviceId },
        data: { isActive: false, revokedAt: new Date() },
      })
      .catch(() => null);

    // Delete the device session record
    await this.prisma.deviceSession.delete({ where: { id: deviceSessionId } });

    this.logger.log(`Revoked device ${session.deviceId} for client ${clientId}`);
  }

  /**
   * Get the fingerprint for a device session record by ID.
   */
  async getDeviceSession(deviceSessionId: string): Promise<KnownDevice | null> {
    const session = await this.prisma.deviceSession.findUnique({
      where: { id: deviceSessionId },
    });
    if (!session) return null;
    return {
      id: session.id,
      deviceId: session.deviceId,
      userAgent: session.userAgent ?? null,
      ip: session.ip ?? null,
      lastSeenAt: session.lastSeenAt,
      createdAt: session.createdAt,
    };
  }
}
