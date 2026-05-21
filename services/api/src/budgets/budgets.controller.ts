import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';

class CheckAvailabilityDto {
  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

@ApiTags('budgets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private budgets: BudgetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a budget for a company or department' })
  create(@Body() dto: CreateBudgetDto) {
    return this.budgets.create(dto);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'List budgets for a company with spent/remaining' })
  findForCompany(@Param('companyId') companyId: string) {
    return this.budgets.findForCompany(companyId);
  }

  @Get('company/:companyId/analytics')
  @ApiOperation({ summary: 'Get spend analytics aggregated by department' })
  getAnalytics(@Param('companyId') companyId: string) {
    return this.budgets.getSpendAnalytics(companyId);
  }

  @Post('check')
  @ApiOperation({ summary: 'Check budget availability before placing an order' })
  checkAvailability(@Body() dto: CheckAvailabilityDto) {
    return this.budgets.checkAvailability(
      dto.companyId,
      dto.departmentId ?? null,
      dto.amount,
    );
  }
}
