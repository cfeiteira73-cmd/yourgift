import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StoreEmployeeGuard, type EmployeeRequest } from './store-employee.guard';
import { StorePortalService } from './store-portal.service';
import { EmployeeLoginDto } from './dto/employee-login.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';

@ApiTags('store-portal')
@Controller('stores/:slug')
export class StorePortalController {
  constructor(private readonly portal: StorePortalService) {}

  // ── POST /api/v1/stores/:slug/auth — PUBLIC ───────────────────────────────

  @Post('auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee login — returns JWT' })
  employeeLogin(
    @Param('slug') slug: string,
    @Body() dto: EmployeeLoginDto,
  ) {
    return this.portal.employeeLogin(slug, dto.email);
  }

  // ── GET /api/v1/stores/:slug/portal — employee auth ───────────────────────

  @Get('portal')
  @UseGuards(StoreEmployeeGuard)
  @ApiOperation({ summary: 'Employee portal data' })
  getPortal(@Param('slug') slug: string, @Req() req: EmployeeRequest) {
    return this.portal.getPortalData(req.employee.sub, slug);
  }

  // ── POST /api/v1/stores/:slug/order — employee auth ──────────────────────

  @Post('order')
  @UseGuards(StoreEmployeeGuard)
  @ApiOperation({ summary: 'Place an employee order' })
  placeOrder(
    @Param('slug') slug: string,
    @Req() req: EmployeeRequest,
    @Body() dto: PlaceOrderDto,
  ) {
    return this.portal.placeOrder(req.employee.sub, slug, dto);
  }

  // ── GET /api/v1/stores/:slug/orders — employee auth ──────────────────────

  @Get('orders')
  @UseGuards(StoreEmployeeGuard)
  @ApiOperation({ summary: 'Employee order history' })
  getOrders(@Param('slug') slug: string, @Req() req: EmployeeRequest) {
    return this.portal.getOrders(req.employee.sub, slug);
  }

  // ── GET /api/v1/stores/:slug/employees — admin auth ──────────────────────

  @Get('employees')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: list store employees' })
  listEmployees(@Param('slug') slug: string) {
    return this.portal.listEmployees(slug);
  }

  // ── POST /api/v1/stores/:slug/employees — admin auth ─────────────────────

  @Post('employees')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: add employee to store' })
  createEmployee(
    @Param('slug') slug: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.portal.createEmployee(slug, dto);
  }

  // ── PATCH /api/v1/stores/:slug/employees/:id — admin auth ────────────────

  @Patch('employees/:employeeId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: update employee' })
  updateEmployee(
    @Param('slug') slug: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.portal.updateEmployee(slug, employeeId, dto);
  }

  // ── POST /api/v1/stores/:slug/employees/:id/credit — admin auth ───────────

  @Post('employees/:employeeId/credit')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: top-up employee allowance (appends to ledger)' })
  creditAllowance(
    @Param('slug') slug: string,
    @Param('employeeId') employeeId: string,
    @Body() body: { amount: number; description: string; actorId?: string },
  ) {
    return this.portal.creditAllowance(
      slug,
      employeeId,
      body.amount,
      body.description,
      body.actorId,
    );
  }

  // ── GET /api/v1/stores/:slug/employees/:id/ledger — admin auth ────────────

  @Get('employees/:employeeId/ledger')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin: view employee allowance ledger history' })
  getLedgerHistory(
    @Param('slug') slug: string,
    @Param('employeeId') employeeId: string,
    @Query('limit') limit?: string,
  ) {
    return this.portal.getLedgerHistory(
      slug,
      employeeId,
      limit !== undefined ? parseInt(limit, 10) : 50,
    );
  }
}
