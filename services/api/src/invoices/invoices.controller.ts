import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a procurement invoice linked to an order' })
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.createInvoice(dto);
  }

  @Patch(':id/paid')
  @ApiOperation({ summary: 'Mark invoice as paid' })
  @ApiQuery({ name: 'paidAt', required: false, description: 'ISO 8601 payment date (defaults to now)' })
  markPaid(@Param('id') id: string, @Query('paidAt') paidAt?: string) {
    return this.invoices.markPaid(id, paidAt ? new Date(paidAt) : undefined);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get all invoices for an order' })
  findByOrder(@Param('orderId') orderId: string) {
    return this.invoices.findByOrder(orderId);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'List all overdue invoices (dueDate < now, status != paid)' })
  findOverdue() {
    return this.invoices.findOverdue();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get invoice totals summary for a tenant' })
  @ApiQuery({ name: 'tenantId', required: true })
  getSummary(@Query('tenantId') tenantId: string) {
    return this.invoices.getInvoiceSummary(tenantId);
  }
}
