import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AiService, CampaignInput } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/v1/ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // GET /api/v1/ai/insights?companyId=
  @Get('insights')
  getInsights(@Query('companyId') companyId?: string) {
    return this.aiService.getBusinessInsights(companyId);
  }

  // GET /api/v1/ai/recommendations/:clientId
  @Get('recommendations/:clientId')
  getRecommendations(@Param('clientId') clientId: string) {
    return this.aiService.getRecommendations(clientId);
  }

  // POST /api/v1/ai/campaign-generator
  @Post('campaign-generator')
  generateCampaign(@Body() body: CampaignInput) {
    return this.aiService.generateCampaign(body);
  }

  // GET /api/v1/ai/supplier-scores
  @Get('supplier-scores')
  getSupplierScores() {
    return this.aiService.getSupplierScores();
  }
}
