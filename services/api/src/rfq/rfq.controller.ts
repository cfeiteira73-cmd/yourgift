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
import { RfqService } from './rfq.service';
import { CreateRfqDto } from './dto/create-rfq.dto';

@ApiTags('rfq')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rfq')
export class RfqController {
  constructor(private readonly rfq: RfqService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new RFQ and send to selected suppliers' })
  create(@Body() dto: CreateRfqDto) {
    return this.rfq.createRfq(dto);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Close an RFQ, optionally selecting a supplier' })
  @ApiQuery({ name: 'supplierId', required: false, description: 'Selected supplier ID' })
  close(@Param('id') id: string, @Query('supplierId') supplierId?: string) {
    return this.rfq.closeRfq(id, supplierId);
  }

  @Get()
  @ApiOperation({ summary: 'List RFQs for a tenant' })
  @ApiQuery({ name: 'tenantId', required: true })
  @ApiQuery({ name: 'status', required: false })
  findByTenant(@Query('tenantId') tenantId: string, @Query('status') status?: string) {
    return this.rfq.findByTenant(tenantId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get RFQ by ID' })
  findOne(@Param('id') id: string) {
    return this.rfq.findById(id);
  }
}
