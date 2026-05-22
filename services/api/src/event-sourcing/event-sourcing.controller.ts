import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventSourcingService, type StreamType } from './event-sourcing.service';

@ApiTags('event-sourcing')
@Controller('api/v1/event-sourcing')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventSourcingController {
  constructor(private readonly es: EventSourcingService) {}

  @Get('stream/:streamId')
  @ApiOperation({ summary: 'Get full event stream for an entity' })
  getStream(@Param('streamId') streamId: string) {
    return this.es.getStream(streamId);
  }

  @Get('stream/:streamId/replay')
  @ApiOperation({ summary: 'Replay events for a stream from a given sequence' })
  replay(
    @Param('streamId') streamId: string,
    @Query('from') from?: string,
  ) {
    return this.es.replay(streamId, from !== undefined ? parseInt(from, 10) : 1);
  }

  @Get('stream/:streamId/state')
  @ApiOperation({ summary: 'Derive current order state from event stream' })
  deriveState(@Param('streamId') streamId: string) {
    return this.es.deriveOrderState(streamId);
  }

  @Get('events')
  @ApiOperation({ summary: 'Query procurement events with optional filters' })
  queryEvents(
    @Query('streamType') streamType?: StreamType,
    @Query('eventType') eventType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.es.queryEvents({
      streamType,
      eventType,
      from: from !== undefined ? new Date(from) : undefined,
      to: to !== undefined ? new Date(to) : undefined,
      limit: limit !== undefined ? parseInt(limit, 10) : 50,
      offset: offset !== undefined ? parseInt(offset, 10) : 0,
    });
  }
}
