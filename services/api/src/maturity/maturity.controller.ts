import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { MaturityService } from './maturity.service';

@ApiTags('maturity')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/maturity')
export class MaturityController {
  constructor(private readonly service: MaturityService) {}

  /**
   * GET /api/v1/maturity
   * Returns the current production maturity level against the
   * Continuous Production Validation Contract.
   *
   * The system self-evaluates every time this endpoint is called.
   * The contract: unvalidated → functional → reliable → scaled → enterprise
   * §9 principle: 100% is never applicable.
   */
  @Get()
  async evaluate() {
    return this.service.evaluate();
  }
}
