import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

class CreateOrderFromCampaignDto {
  @IsObject()
  shippingAddress: Record<string, unknown>;
}

class UpdateCampaignStatusDto {
  @IsString()
  status: string;
}

class AddCampaignItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'List all campaigns (admin view, optional status filter)' })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Query('status') status?: string) {
    return this.campaigns.findAll(status);
  }

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

  @Patch(':id')
  @ApiOperation({ summary: 'Update campaign status (pause / activate / complete)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCampaignStatusDto) {
    return this.campaigns.updateStatus(id, dto.status);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a draft campaign (draft → active)' })
  activate(@Param('id') id: string) {
    return this.campaigns.activate(id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add an item to a campaign' })
  addItem(@Param('id') id: string, @Body() dto: AddCampaignItemDto) {
    return this.campaigns.addItem(id, dto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Remove an item from a campaign' })
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.campaigns.removeItem(id, itemId);
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
