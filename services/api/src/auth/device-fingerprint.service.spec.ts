import { Test, TestingModule } from '@nestjs/testing';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockDeviceSession = {
  id: 'ds_1',
  clientId: 'client_1',
  deviceId: 'fp_abc123def456789',
  userAgent: 'Mozilla/5.0',
  ip: '1.2.3.4',
  lastSeenAt: new Date(),
  createdAt: new Date('2026-01-01'),
};

const mockPrisma = {
  deviceSession: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  activeSession: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
};

const baseSignals = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  acceptLanguage: 'en-US,en;q=0.9',
  platform: 'Win32',
  screenResolution: '1920x1080',
  timezone: 'Europe/Lisbon',
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('DeviceFingerprintService', () => {
  let service: DeviceFingerprintService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceFingerprintService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DeviceFingerprintService>(DeviceFingerprintService);
  });

  // ── generateFingerprint ───────────────────────────────────────────────────

  it('returns a 16-character lowercase hex string', () => {
    const fp = service.generateFingerprint(baseSignals);
    expect(typeof fp).toBe('string');
    expect(fp).toHaveLength(16);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic — identical signals always produce the same fingerprint', () => {
    const fp1 = service.generateFingerprint(baseSignals);
    const fp2 = service.generateFingerprint({ ...baseSignals });
    expect(fp1).toBe(fp2);
  });

  it('produces a different fingerprint when userAgent differs', () => {
    const fp1 = service.generateFingerprint(baseSignals);
    const fp2 = service.generateFingerprint({
      ...baseSignals,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    });
    expect(fp1).not.toBe(fp2);
  });

  it('handles completely empty signals without throwing', () => {
    const fp = service.generateFingerprint({});
    expect(typeof fp).toBe('string');
    expect(fp).toHaveLength(16);
  });

  // ── registerDevice ────────────────────────────────────────────────────────

  it('returns isKnown=false for a device seen for the first time', async () => {
    const fp = service.generateFingerprint(baseSignals);
    mockPrisma.deviceSession.findFirst.mockResolvedValue(null); // not seen before
    mockPrisma.deviceSession.upsert.mockResolvedValue({ ...mockDeviceSession, deviceId: fp });

    const result = await service.registerDevice('client_1', fp, baseSignals, '1.2.3.4');

    expect(result.isKnown).toBe(false);
    expect(result.deviceSessionId).toBeDefined();
  });

  it('returns isKnown=true for a previously registered device', async () => {
    const fp = service.generateFingerprint(baseSignals);
    mockPrisma.deviceSession.findFirst.mockResolvedValue({ ...mockDeviceSession, deviceId: fp });
    mockPrisma.deviceSession.upsert.mockResolvedValue({ ...mockDeviceSession, deviceId: fp });

    const result = await service.registerDevice('client_1', fp, baseSignals, '1.2.3.4');

    expect(result.isKnown).toBe(true);
  });

  it('returns riskLevel=low for a known device', async () => {
    const fp = service.generateFingerprint(baseSignals);
    mockPrisma.deviceSession.findFirst.mockResolvedValue({ ...mockDeviceSession, deviceId: fp });
    mockPrisma.deviceSession.upsert.mockResolvedValue({ ...mockDeviceSession, deviceId: fp });

    const result = await service.registerDevice('client_1', fp, baseSignals, '1.2.3.4');

    expect(result.riskLevel).toBe('low');
  });

  it('returns riskLevel=medium for a new device with a normal user agent', async () => {
    const fp = service.generateFingerprint(baseSignals);
    mockPrisma.deviceSession.findFirst.mockResolvedValue(null);
    mockPrisma.deviceSession.upsert.mockResolvedValue({ ...mockDeviceSession, deviceId: fp });

    const result = await service.registerDevice('client_1', fp, baseSignals, '1.2.3.4');

    expect(result.riskLevel).toBe('medium');
  });

  it('returns riskLevel=high for a new device with a bot/headless user agent', async () => {
    const botSignals = { ...baseSignals, userAgent: 'HeadlessChrome/120 Puppeteer' };
    const fp = service.generateFingerprint(botSignals);
    mockPrisma.deviceSession.findFirst.mockResolvedValue(null);
    mockPrisma.deviceSession.upsert.mockResolvedValue({ ...mockDeviceSession, deviceId: fp });

    const result = await service.registerDevice('client_1', fp, botSignals, '1.2.3.4');

    expect(result.riskLevel).toBe('high');
  });

  it('upserts the DeviceSession on every call (known or unknown)', async () => {
    const fp = service.generateFingerprint(baseSignals);
    mockPrisma.deviceSession.findFirst.mockResolvedValue({ ...mockDeviceSession, deviceId: fp });
    mockPrisma.deviceSession.upsert.mockResolvedValue({ ...mockDeviceSession, deviceId: fp });

    await service.registerDevice('client_1', fp, baseSignals, '5.6.7.8');

    expect(mockPrisma.deviceSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId_deviceId: { clientId: 'client_1', deviceId: fp } },
      }),
    );
  });

  // ── getKnownDevices ───────────────────────────────────────────────────────

  it('returns all DeviceSession records for a clientId', async () => {
    const sessions = [mockDeviceSession, { ...mockDeviceSession, id: 'ds_2' }];
    mockPrisma.deviceSession.findMany.mockResolvedValue(sessions);

    const result = await service.getKnownDevices('client_1');

    expect(result).toHaveLength(2);
    expect(mockPrisma.deviceSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: 'client_1' } }),
    );
  });

  it('maps Prisma records to KnownDevice shape (id, deviceId, userAgent, ip, timestamps)', async () => {
    mockPrisma.deviceSession.findMany.mockResolvedValue([mockDeviceSession]);

    const [device] = await service.getKnownDevices('client_1');

    expect(device).toMatchObject({
      id: 'ds_1',
      deviceId: expect.any(String),
      userAgent: expect.any(String),
      ip: expect.any(String),
      lastSeenAt: expect.any(Date),
      createdAt: expect.any(Date),
    });
  });

  // ── revokeDevice ──────────────────────────────────────────────────────────

  it('does nothing (no throw) if device session not found', async () => {
    mockPrisma.deviceSession.findFirst.mockResolvedValue(null);

    // Service logs warning and returns — does NOT throw
    await expect(
      service.revokeDevice('client_1', 'ds_missing'),
    ).resolves.not.toThrow();

    expect(mockPrisma.deviceSession.delete).not.toHaveBeenCalled();
  });

  it('revokes all ActiveSessions and deletes the DeviceSession', async () => {
    mockPrisma.deviceSession.findFirst.mockResolvedValue(mockDeviceSession);
    mockPrisma.activeSession.updateMany.mockResolvedValue({ count: 3 });
    mockPrisma.deviceSession.delete.mockResolvedValue(mockDeviceSession);

    await service.revokeDevice('client_1', 'ds_1');

    expect(mockPrisma.activeSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'client_1' }),
        data: expect.objectContaining({ isActive: false }),
      }),
    );
    expect(mockPrisma.deviceSession.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ds_1' } }),
    );
  });
});
