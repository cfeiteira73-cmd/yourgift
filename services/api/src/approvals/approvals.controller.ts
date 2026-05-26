import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovalsService } from './approvals.service';

class ResolveApprovalDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

class RejectApprovalDto {
  @IsString()
  notes: string;
}

class PatchApprovalDto {
  @IsEnum(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private approvals: ApprovalsService) {}

  @Get()
  @ApiOperation({ summary: 'List approvals with optional status filter (admin view)' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  findAll(@Query('status') status?: string) {
    return this.approvals.findAll(status);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending approvals for the authenticated approver (by email)' })
  getPending(@Request() req: any) {
    return this.approvals.getPendingForApprover(req.user.email);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get all approvals for a specific order' })
  getForOrder(@Param('orderId') orderId: string) {
    return this.approvals.getForOrder(orderId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Approve or reject an approval (admin shorthand)' })
  patch(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: PatchApprovalDto,
  ) {
    if (dto.status === 'approved') {
      return this.approvals.approve(id, req.user.id, dto.notes);
    }
    return this.approvals.reject(id, req.user.id, dto.notes ?? '');
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a pending approval stage' })
  approve(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ResolveApprovalDto,
  ) {
    return this.approvals.approve(id, req.user.id, dto.notes);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a pending approval stage (cancels the order)' })
  reject(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RejectApprovalDto,
  ) {
    return this.approvals.reject(id, req.user.id, dto.notes);
  }
}
