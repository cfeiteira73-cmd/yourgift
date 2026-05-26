import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  BusinessRealityEngine,
  GlobalBusinessReality,
  TenantBusinessReality,
} from './business-reality.service';

@ApiTags('business-reality')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/business-reality')
export class BusinessRealityController {
  constructor(private readonly service: BusinessRealityEngine) {}

  @Get('global')
  @ApiOperation({
    summary:
      'Global business reality snapshot — revenue, refunds, churn, LTV, supplier profitability, repeat rate',
  })
  async getGlobalBusinessReality(): Promise<GlobalBusinessReality> {
    return this.service.getGlobalBusinessReality();
  }

  @Get('tenant/:id')
  @ApiOperation({
    summary: 'Tenant-scoped business reality — same metrics filtered to a single tenant',
  })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  async getTenantBusinessReality(
    @Param('id') id: string,
  ): Promise<TenantBusinessReality> {
    return this.service.getTenantBusinessReality(id);
  }
}
