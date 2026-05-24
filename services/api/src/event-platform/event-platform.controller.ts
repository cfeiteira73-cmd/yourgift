import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DLQService, FailureCategory } from './dlq.service';
import { EventReplayService } from './event-replay.service';
import { EventConsumerService } from './event-consumer.service';

@Controller('event-platform')
@UseGuards(JwtAuthGuard)
export class EventPlatformController {
  constructor(
    private readonly dlq: DLQService,
    private readonly replay: EventReplayService,
    private readonly consumers: EventConsumerService,
  ) {}

  // ── DLQ ─────────────────────────────────────────────────────────────────

  @Get('dlq')
  listDLQ(
    @Query('status') status?: string,
    @Query('group') group?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dlq.list({ status, consumerGroup: group, limit: limit ? Number(limit) : 50 });
  }

  @Get('dlq/stats')
  dlqStats() {
    return this.dlq.getStats();
  }

  @Post('dlq')
  enqueueDLQ(
    @Body()
    body: {
      streamId: string;
      streamType: string;
      eventType: string;
      eventId: string;
      payload: Record<string, unknown>;
      failureReason: string;
      failureCategory?: FailureCategory;
      consumerGroup?: string;
    },
  ) {
    return this.dlq.enqueue(body);
  }

  @Post('dlq/:id/replay')
  replayDLQ(@Param('id') id: string, @Body() body: { replayedBy?: string }) {
    return this.dlq.replay(id, body.replayedBy);
  }

  @Post('dlq/replay-batch')
  replayBatch(
    @Body()
    body: {
      consumerGroup?: string;
      eventType?: string;
      limit?: number;
      replayedBy?: string;
    },
  ) {
    return this.dlq.replayBatch(body, body.replayedBy);
  }

  @Delete('dlq/:id')
  discardDLQ(@Param('id') id: string) {
    return this.dlq.discard(id);
  }

  // ── Replay Engine ────────────────────────────────────────────────────────

  @Post('replay/stream')
  replayStream(
    @Body()
    body: {
      streamId: string;
      fromSequence?: number;
      toSequence?: number;
      consumerGroup?: string;
    },
  ) {
    return this.replay.replayStream(body);
  }

  @Post('replay/consumer-group')
  replayConsumerGroup(@Body() body: { consumerGroup: string; streamType?: string }) {
    return this.replay.replayForConsumerGroup(body.consumerGroup, body.streamType);
  }

  @Post('replay/full-rebuild')
  fullRebuild(@Body() body: { dryRun?: boolean }) {
    return this.replay.fullSystemRebuild(body.dryRun ?? true);
  }

  @Get('health')
  streamHealth() {
    return this.replay.getEventStreamHealth();
  }

  // ── Consumer Groups ──────────────────────────────────────────────────────

  @Get('consumers')
  getConsumers() {
    return this.consumers.getAllOffsets();
  }

  @Post('consumers/register')
  registerConsumer(@Body() body: { consumerGroup: string; streamType?: string }) {
    return this.consumers.registerGroup(body.consumerGroup, body.streamType);
  }

  @Get('consumers/:group/lag')
  getConsumerLag(
    @Param('group') group: string,
    @Query('streamType') streamType?: string,
  ) {
    return this.consumers.getConsumerLag(group, streamType);
  }
}
