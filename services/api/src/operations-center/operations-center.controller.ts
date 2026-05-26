import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { ProductionOperationsCenterService } from './operations-center.service';

@ApiTags('operations-center')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/operations-center')
export class OperationsCenterController {
  constructor(
    private readonly operationsCenterService: ProductionOperationsCenterService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get a full production operations snapshot including health score, queue state, webhook health, and infra cost estimates' })
  getOperationsSnapshot() {
    return this.operationsCenterService.getOperationsSnapshot();
  }
}
