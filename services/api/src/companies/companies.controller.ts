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
import {
  CompaniesService,
  CreateCompanyDto,
  UpdateCompanyDto,
} from './companies.service';

@ApiTags('companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  // ─── GET /api/v1/companies/stats ───────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregate KPI stats for the companies CRM page' })
  getStats() {
    return this.companies.getStats();
  }

  // ─── GET /api/v1/companies ─────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all companies with aggregated stats' })
  findAll() {
    return this.companies.findAll();
  }

  // ─── GET /api/v1/companies/:id ─────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get company detail with clients, departments, stores, budgets' })
  findOne(@Param('id') id: string) {
    return this.companies.findOne(id);
  }

  // ─── POST /api/v1/companies ────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new company' })
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  // ─── PATCH /api/v1/companies/:id ──────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update a company' })
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companies.update(id, dto);
  }
}
