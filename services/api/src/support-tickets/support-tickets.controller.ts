import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  SupportTicketsService,
  CreateTicketInput,
} from './support-tickets.service';

@ApiTags('support-tickets')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/support-tickets')
export class SupportTicketsController {
  constructor(private readonly service: SupportTicketsService) {}

  // ── POST /api/v1/admin/support-tickets ────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new support ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  createTicket(@Body() body: CreateTicketInput) {
    return this.service.createTicket(body);
  }

  // ── GET /api/v1/admin/support-tickets ─────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List support tickets with optional filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'escalationLevel', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of tickets.' })
  getTickets(
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('escalationLevel') escalationLevel?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getTickets({
      status,
      category,
      escalationLevel,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // ── GET /api/v1/admin/support-tickets/stats ───────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregate ticket statistics' })
  @ApiResponse({ status: 200, description: 'Ticket stats.' })
  getStats() {
    return this.service.getStats();
  }

  // ── GET /api/v1/admin/support-tickets/:id ────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a support ticket by ID' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket found.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  getTicketById(@Param('id') id: string) {
    return this.service.getTicketById(id);
  }

  // ── POST /api/v1/admin/support-tickets/:id/assign ────────────────────────

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a ticket to a staff member' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket assigned.' })
  assignTicket(
    @Param('id') id: string,
    @Body() body: { assignedTo: string },
  ) {
    return this.service.assignTicket(id, body.assignedTo);
  }

  // ── POST /api/v1/admin/support-tickets/:id/escalate ──────────────────────

  @Post(':id/escalate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate a ticket to L2 or L3' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket escalated.' })
  escalateTicket(
    @Param('id') id: string,
    @Body() body: { toLevel: 'L2' | 'L3'; reason: string },
  ) {
    return this.service.escalateTicket(id, body.toLevel, body.reason);
  }

  // ── POST /api/v1/admin/support-tickets/:id/resolve ───────────────────────

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a support ticket' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket resolved.' })
  resolveTicket(
    @Param('id') id: string,
    @Body() body: { resolutionNotes: string },
  ) {
    return this.service.resolveTicket(id, body.resolutionNotes);
  }

  // ── POST /api/v1/admin/support-tickets/:id/auto-triage ───────────────────

  @Post(':id/auto-triage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run L1 auto-triage logic on a ticket',
    description:
      'Automatically resolves or escalates a ticket based on its category and related order/job state.',
  })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Triage result.' })
  autoTriageTicket(@Param('id') id: string) {
    return this.service.autoTriageTicket(id);
  }
}
