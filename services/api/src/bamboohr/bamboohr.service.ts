import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../events/event-bus.service';
import { PrismaService } from '../prisma/prisma.service';

export interface BambooEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  location?: string;
  hireDate?: string;
  jobTitle?: string;
  companyDomain?: string; // used to match Company in our DB
}

@Injectable()
export class BambooHRService implements OnModuleInit {
  private readonly logger = new Logger(BambooHRService.name);
  private readonly apiKey: string | undefined;
  private readonly subdomain: string | undefined;
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventBusService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.config.get<string>('BAMBOOHR_API_KEY');
    this.subdomain = this.config.get<string>('BAMBOOHR_SUBDOMAIN');
    this.baseUrl = `https://api.bamboohr.com/api/gateway.php/${this.subdomain ?? 'company'}/v1`;
  }

  onModuleInit() {
    if (!this.apiKey) {
      this.logger.warn('BAMBOOHR_API_KEY not set — BambooHR integration disabled');
      return;
    }
    this.logger.log(`BambooHR integration active (subdomain: ${this.subdomain ?? 'company'})`);
  }

  private async bambooFetch(path: string, method = 'GET', body?: object): Promise<unknown> {
    if (!this.apiKey) return null;
    try {
      const credentials = Buffer.from(`${this.apiKey}:x`).toString('base64');
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        this.logger.warn(`BambooHR ${method} ${path} → ${res.status}`);
        return null;
      }
      return res.json() as Promise<unknown>;
    } catch (err) {
      this.logger.error(`BambooHR fetch error: ${String(err)}`);
      return null;
    }
  }

  /**
   * Called by the webhook handler when a new employee is added in BambooHR.
   * Attempts to match the employee to an existing Company by domain, then
   * emits an `employee.onboarded` event that triggers the onboarding-kit flow.
   */
  async handleNewEmployee(employeeData: BambooEmployee): Promise<{ handled: boolean; companyId?: string }> {
    this.logger.log(
      `New employee from BambooHR: ${employeeData.firstName} ${employeeData.lastName} <${employeeData.email}>`,
    );

    // Try to find matching company by email domain
    let companyId: string | undefined;
    const emailDomain = employeeData.companyDomain ?? employeeData.email.split('@')[1];
    if (emailDomain) {
      const company = await this.prisma.company.findFirst({
        where: { domain: { contains: emailDomain } },
        select: { id: true },
      });
      companyId = company?.id;
    }

    // Emit event for onboarding kit trigger
    this.events.emit('employee.onboarded', {
      source: 'bamboohr',
      employeeId: employeeData.id,
      name: `${employeeData.firstName} ${employeeData.lastName}`,
      email: employeeData.email,
      department: employeeData.department,
      location: employeeData.location,
      hireDate: employeeData.hireDate,
      jobTitle: employeeData.jobTitle,
      companyId,
    });

    return { handled: true, companyId };
  }

  async getEmployees(
    fields = 'firstName,lastName,email,department,location,hireDate,jobTitle',
  ): Promise<unknown> {
    return this.bambooFetch(`/employees/directory?fields=${fields}`);
  }

  async getEmployee(employeeId: string): Promise<unknown> {
    return this.bambooFetch(
      `/employees/${employeeId}?fields=firstName,lastName,email,department,location,hireDate,jobTitle`,
    );
  }
}
