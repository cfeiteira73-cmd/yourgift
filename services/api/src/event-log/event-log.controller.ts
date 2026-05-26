import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventLogService } from './event-log.service';

@ApiTags('admin/event-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventLogController {
  constructor(private readonly eventLogService: EventLogService) {}

  @Get()
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'event', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findMany(
    @Query('entity') entity?: string,
    @Query('event') event?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.eventLogService.findMany({
      entity,
      event,
      actorId,
      from,
      to,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}
