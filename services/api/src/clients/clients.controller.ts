import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientsService, CreateClientDto, UpdateClientDto } from './clients.service';

@ApiTags('clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  // ─── GET /api/v1/clients/stats ─────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregate KPI stats for the clients CRM page' })
  getStats() {
    return this.clients.getStats();
  }

  // ─── GET /api/v1/clients ───────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all clients with aggregated order stats' })
  findAll() {
    return this.clients.findAll();
  }

  // ─── GET /api/v1/clients/:id ───────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get client detail with recent orders and company' })
  findOne(@Param('id') id: string) {
    return this.clients.findOne(id);
  }

  // ─── POST /api/v1/clients ──────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new client' })
  create(@Body() dto: CreateClientDto) {
    return this.clients.create(dto);
  }

  // ─── PATCH /api/v1/clients/:id ─────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update a client' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clients.update(id, dto);
  }
}
