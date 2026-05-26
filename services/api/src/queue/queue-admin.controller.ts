import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { QueueService, QueueStats, QueueMetrics } from './queue.service';
import { DlqService, DlqItem } from './dlq.service';
import { QUEUE_NAMES } from './queue.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

/**
 * Queue Admin Controller
 *
 * Provides operational visibility and control over BullMQ queues.
 * Protected by JWT + Admin guard — internal ops use only.
 *
 * GET  /api/v1/admin/queues           — all queue stats
 * GET  /api/v1/admin/queues/:name     — single queue stats
 * GET  /api/v1/admin/queues/dlq       — list DLQ items
 * POST /api/v1/admin/queues/dlq/:id/replay — replay one DLQ item
 * POST /api/v1/admin/queues/dlq/replay-all/:queue — replay all for a source queue
 */
@ApiTags('Admin — Queues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/queues')
export class QueueAdminController {
  constructor(
    private readonly queueService: QueueService,
    private readonly dlqService: DlqService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get stats for all queues' })
  async getAllStats(): Promise<{ queues: QueueStats[] }> {
    const queues = await this.queueService.getAllQueueStats();
    return { queues };
  }

  @Get('dlq')
  @ApiOperation({ summary: 'List Dead Letter Queue items' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max items (default 50)' })
  async listDlq(@Query('limit') limit = 50): Promise<{ items: DlqItem[]; total: number }> {
    const items = await this.dlqService.list(Number(limit));
    return { items, total: items.length };
  }

  @Post('dlq/:id/replay')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Replay a single DLQ item by job ID' })
  @ApiParam({ name: 'id', description: 'DLQ job ID' })
  async replayOne(@Param('id') id: string): Promise<{ replayed: string }> {
    await this.dlqService.replay(id);
    return { replayed: id };
  }

  @Post('dlq/replay-all/:queue')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Replay all DLQ items for a given source queue' })
  @ApiParam({ name: 'queue', description: 'Original queue name', enum: Object.values(QUEUE_NAMES) })
  async replayAllForQueue(@Param('queue') queue: string): Promise<{ queue: string; replayed: number }> {
    const count = await this.dlqService.replayQueue_byOriginal(queue);
    return { queue, replayed: count };
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get lag metrics for all queues',
    description:
      'Returns waiting/active/failed/completed counts plus estimated lag in seconds and health status (healthy/degraded/critical) for each queue.',
  })
  async getMetrics(): Promise<{ metrics: QueueMetrics[]; capturedAt: string }> {
    const metrics = await this.queueService.getQueueMetrics();
    return { metrics, capturedAt: new Date().toISOString() };
  }

  @Get(':name')
  @ApiOperation({ summary: 'Get stats for a specific queue' })
  @ApiParam({ name: 'name', description: 'Queue name', enum: Object.values(QUEUE_NAMES) })
  async getStats(@Param('name') name: string): Promise<QueueStats> {
    return this.queueService.getQueueStats(name);
  }
}
