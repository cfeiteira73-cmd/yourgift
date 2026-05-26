import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class HiBobService implements OnModuleInit {
  private readonly logger = new Logger(HiBobService.name);
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {
    this.apiKey = this.config.get<string>('HIBOB_API_KEY') ?? '';
    this.enabled = !!this.apiKey;
    if (!this.enabled) this.logger.warn('HiBob: HIBOB_API_KEY not set — integration disabled');
  }

  onModuleInit() {
    // Subscribe to the shared onboarding event (same as BambooHR)
    this.events.on('employee.onboarded', async (payload: { email: string; name?: string; companyId?: string; source?: string }) => {
      if (payload.source === 'hibob') {
        this.logger.log(`HiBob employee onboarded: ${payload.email}`);
      }
    });
  }

  /** Handle HiBob webhook — new employee created */
  async handleNewEmployee(body: Record<string, unknown>): Promise<void> {
    // HiBob webhook payload structure: body.data.employee
    const emp = (body['data'] as Record<string, unknown>)?.['employee'] as Record<string, unknown> | undefined;
    if (!emp) {
      this.logger.warn('HiBob webhook: no employee data in payload');
      return;
    }

    const email = (emp['email'] ?? emp['workEmail']) as string | undefined;
    const name = `${emp['firstName'] ?? ''} ${emp['surname'] ?? ''}`.trim();
    const department = emp['department'] as string | undefined;
    const companyId = emp['companyId'] as string | undefined;

    if (!email) {
      this.logger.warn('HiBob webhook: employee has no email');
      return;
    }

    // Persist sync event
    await this.prisma.hibobSyncEvent.create({
      data: {
        employeeId: (emp['id'] as string) ?? email,
        employeeEmail: email,
        eventType: 'employee.onboarded',
        payload: body as object,
      },
    });

    // Emit the same event as BambooHR for unified handling
    this.events.emit('employee.onboarded', {
      email,
      name,
      department,
      companyId,
      source: 'hibob',
    });

    this.logger.log(`HiBob: new employee onboarded — ${email} (${name})`);
  }

  /** Handle HiBob webhook — employee updated */
  async handleEmployeeUpdate(body: Record<string, unknown>): Promise<void> {
    const emp = (body['data'] as Record<string, unknown>)?.['employee'] as Record<string, unknown> | undefined;
    if (!emp) return;

    const email = (emp['email'] ?? emp['workEmail']) as string | undefined;
    if (!email) return;

    await this.prisma.hibobSyncEvent.create({
      data: {
        employeeId: (emp['id'] as string) ?? email,
        employeeEmail: email,
        eventType: 'employee.updated',
        payload: body as object,
      },
    });

    this.events.emit('employee.updated', { email, source: 'hibob' });
    this.logger.log(`HiBob: employee updated — ${email}`);
  }

  /** Fetch all active employees from HiBob API (if key available) */
  async fetchEmployees(): Promise<unknown[]> {
    if (!this.enabled) return [];
    try {
      const res = await fetch('https://api.hibob.com/v1/people', {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${this.apiKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        this.logger.error(`HiBob API error: ${res.status} ${res.statusText}`);
        return [];
      }
      const data = await res.json() as { employees?: unknown[] };
      return data.employees ?? [];
    } catch (err) {
      this.logger.error(`HiBob fetch employees error: ${err}`);
      return [];
    }
  }

  /** Get recent HiBob sync events */
  async getSyncHistory(limit = 50) {
    return this.prisma.hibobSyncEvent.findMany({
      orderBy: { processedAt: 'desc' },
      take: limit,
    });
  }
}
