import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { GdprService, CreateGdprRequestInput, PlaceHoldInput } from './gdpr.service';

interface UpdateRetentionBody {
  retentionDays: number;
}

@ApiTags('governance')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('governance')
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Get('requests')
  async getRequests(
    @Query('status') status?: string,
    @Query('requestType') requestType?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset = 0,
  ): Promise<unknown[]> {
    return this.gdprService.getRequests({ status, requestType, tenantId, limit, offset });
  }

  @Post('requests')
  async createRequest(@Body() body: CreateGdprRequestInput): Promise<unknown> {
    return this.gdprService.createRequest(body);
  }

  @Post('requests/:id/process')
  async processRequest(@Param('id') id: string): Promise<unknown> {
    return this.gdprService.processRequest(id);
  }

  @Get('holds')
  async getHolds(@Query('tenantId') tenantId?: string): Promise<unknown[]> {
    return this.gdprService.getHolds(tenantId);
  }

  @Post('holds')
  async placeHold(@Body() body: PlaceHoldInput): Promise<unknown> {
    return this.gdprService.placeHold(body);
  }

  @Delete('holds/:id')
  async releaseHold(
    @Param('id') id: string,
    @Body('releasedBy') releasedBy: string,
  ): Promise<unknown> {
    return this.gdprService.releaseHold(id, releasedBy ?? 'admin');
  }

  @Get('retention')
  async getRetention(): Promise<unknown[]> {
    return this.gdprService.getRetentionPolicies();
  }

  @Patch('retention/:entityType')
  async updateRetention(
    @Param('entityType') entityType: string,
    @Body() body: UpdateRetentionBody,
  ): Promise<unknown> {
    return this.gdprService.updateRetentionPolicy(entityType, body.retentionDays);
  }
}
