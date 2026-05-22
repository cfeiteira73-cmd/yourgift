import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersService, AnalyticsFilters, OrderFilters } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { OrderStatus } from './order-state-machine';

interface AuthRequest extends Request {
  user: { id: string; role?: string };
}

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // ─── POST /orders ──────────────────────────────────────────────────────────

  @Post()
  create(@Request() req: AuthRequest, @Body() dto: CreateOrderDto) {
    return this.orders.create(req.user.id, dto);
  }

  // ─── GET /orders/analytics ─────────────────────────────────────────────────

  @Get('analytics')
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getAnalytics(
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: AnalyticsFilters = {};
    if (companyId) filters.companyId = companyId;
    if (from && to) {
      filters.dateRange = { from: new Date(from), to: new Date(to) };
    }
    return this.orders.getAnalytics(filters);
  }

  // ─── GET /orders/dashboard ─────────────────────────────────────────────────

  @Get('dashboard')
  getDashboardKpis() {
    return this.orders.getDashboardKpis();
  }

  // ─── GET /orders ───────────────────────────────────────────────────────────

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  findAll(
    @Request() req: AuthRequest,
    @Query('status') status?: string,
    @Query('companyId') companyId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: OrderFilters = {};
    if (status) filters.status = status as OrderStatus;
    if (companyId) filters.companyId = companyId;
    if (from && to) {
      filters.dateRange = { from: new Date(from), to: new Date(to) };
    }
    return this.orders.findAll(req.user.id, filters);
  }

  // ─── GET /orders/:id ───────────────────────────────────────────────────────

  @Get(':id')
  findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.orders.findOne(id, req.user.id);
  }

  // ─── PATCH /orders/:id/status ──────────────────────────────────────────────

  @Patch(':id/status')
  updateStatus(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, dto.status, dto.actorId ?? req.user.id);
  }

  // ─── POST /orders/:id/fulfill ─────────────────────────────────────────────

  @Post(':id/fulfill')
  fulfillOrder(@Request() req: AuthRequest, @Param('id') id: string) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }
    return this.orders.fulfillOrder(id, req.user.id);
  }

  // ─── POST /orders/:id/cancel ───────────────────────────────────────────────

  @Post(':id/cancel')
  cancelOrder(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancelOrder(id, dto.reason, req.user.id);
  }
}
