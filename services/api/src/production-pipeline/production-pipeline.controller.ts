import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  ProductionPipelineService,
  ProductionJobCreateInput,
} from './production-pipeline.service';

class CompleteJobDto {
  externalJobId?: string;
  notes?: string;
}

class FailJobDto {
  reason: string;
}

class RequeueJobDto {
  priority?: number;
}

@ApiTags('production-pipeline')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/production')
export class ProductionPipelineController {
  constructor(private readonly service: ProductionPipelineService) {}

  @Post('jobs')
  @ApiOperation({ summary: 'Create a new production job for an order' })
  createProductionJob(@Body() body: ProductionJobCreateInput) {
    return this.service.createProductionJob(body);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Get the production queue, optionally filtered by status' })
  @ApiQuery({ name: 'status', required: false, type: String })
  getQueue(@Query('status') status?: string) {
    return this.service.getQueue(status);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get a production job by ID' })
  getJobById(@Param('id') id: string) {
    return this.service.getJobById(id);
  }

  @Post('jobs/:id/start')
  @ApiOperation({ summary: 'Start a queued or requeued production job' })
  startJob(@Param('id') id: string) {
    return this.service.startJob(id);
  }

  @Post('jobs/:id/complete')
  @ApiOperation({ summary: 'Mark a production job as completed' })
  completeJob(@Param('id') id: string, @Body() body: CompleteJobDto) {
    return this.service.completeJob(id, body.externalJobId, body.notes);
  }

  @Post('jobs/:id/fail')
  @ApiOperation({ summary: 'Mark a production job as failed with a reason' })
  failJob(@Param('id') id: string, @Body() body: FailJobDto) {
    return this.service.failJob(id, body.reason);
  }

  @Post('jobs/:id/requeue')
  @ApiOperation({ summary: 'Requeue a failed production job' })
  requeueJob(@Param('id') id: string, @Body() body: RequeueJobDto) {
    return this.service.requeueJob(id, body.priority);
  }

  @Get('orders/:orderId/artwork-check')
  @ApiOperation({ summary: 'Validate that all artwork for an order is approved and ready for production' })
  artworkCheck(@Param('orderId') orderId: string) {
    return this.service.validateArtworkForProduction(orderId);
  }
}
