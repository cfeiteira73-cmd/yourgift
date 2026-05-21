import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsObject, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

class CreateOrderFromCampaignDto {
  @IsObject()
  shippingAddress: Record<string, unknown>;
}

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign (starts as draft)' })
  create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'List all campaigns for a company' })
  findForCompany(@Param('companyId') companyId: string) {
    return this.campaigns.findForCompany(companyId);
  }

  @Get('company/:companyId/analytics')
  @ApiOperation({ summary: 'Campaign analytics for a company' })
  getAnalytics(@Param('companyId') companyId: string) {
    return this.campaigns.getAnalytics(companyId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign detail with items and recent orders' })
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a draft campaign (draft → active)' })
  activate(@Param('id') id: string) {
    return this.campaigns.activate(id);
  }

  @Post(':id/order')
  @ApiOperation({ summary: 'Create an order from an active campaign' })
  createOrder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateOrderFromCampaignDto,
  ) {
    return this.campaigns.createOrderFromCampaign(id, req.user.id, dto.shippingAddress);
  }
}
