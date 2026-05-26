import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { DeploymentSafetyService } from './deployment-safety.service';

@ApiTags('deployment-safety')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/deployment-safety')
export class DeploymentSafetyController {
  constructor(private readonly service: DeploymentSafetyService) {}

  /** Run all deployment safety gates — returns SAFE/BLOCKED + reason */
  @Get()
  async runGates() {
    return this.service.runGates();
  }

  /** Simple boolean for CI/CD pipeline integration */
  @Get('should-block')
  async shouldBlock() {
    const block = await this.service.shouldBlockDeploy();
    return { shouldBlock: block, checkedAt: new Date().toISOString() };
  }
}
