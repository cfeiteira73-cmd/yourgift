import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  IncidentService,
  CreateIncidentInput,
  IncidentSeverity,
  IncidentStatus,
} from './incident.service';

interface UpdateStatusBody {
  status: IncidentStatus;
  actor?: string;
}

interface AddEventBody {
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}

@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('incidents')
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get()
  async list(
    @Query('severity') severity?: IncidentSeverity,
    @Query('status') status?: IncidentStatus,
    @Query('tenantId') tenantId?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ): Promise<unknown[]> {
    return this.incidentService.getIncidents({ severity, status, tenantId, limit, offset });
  }

  @Get('stats')
  async stats(): Promise<Record<string, number>> {
    return this.incidentService.getStats();
  }

  @Get(':id')
  async getOne(@Param('id') id: string): Promise<unknown> {
    return this.incidentService.getIncidentById(id);
  }

  @Post()
  async create(@Body() body: CreateIncidentInput): Promise<unknown> {
    return this.incidentService.createIncident(body);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusBody,
  ): Promise<unknown> {
    return this.incidentService.updateStatus(id, body.status, body.actor);
  }

  @Post(':id/events')
  async addEvent(
    @Param('id') id: string,
    @Body() body: AddEventBody,
  ): Promise<unknown> {
    return this.incidentService.addEvent(
      id,
      body.eventType,
      body.message,
      body.metadata,
    );
  }
}
