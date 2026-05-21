import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
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

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private approvals: ApprovalsService) {}

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
