import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get()
  async check(): Promise<Record<string, unknown>> {
    return this.health.check() as unknown as Promise<Record<string, unknown>>;
  }
}
