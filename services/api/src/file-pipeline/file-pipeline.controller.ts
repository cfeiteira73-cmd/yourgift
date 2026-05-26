import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { FilePipelineService } from './file-pipeline.service';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('admin/file-pipeline')
@UseGuards(AdminAuthGuard)
export class FilePipelineController {
  constructor(private readonly svc: FilePipelineService) {}

  @Post('validate/:artworkId')
  validateArtwork(@Param('artworkId') artworkId: string) {
    return this.svc.validateArtwork(artworkId);
  }

  @Post('validate-order/:orderId')
  validateAllForOrder(@Param('orderId') orderId: string) {
    return this.svc.validateAllForOrder(orderId);
  }

  @Get('history/:artworkId')
  getHistory(@Param('artworkId') artworkId: string) {
    return this.svc.getValidationHistory(artworkId);
  }

  @Get('summary/:orderId')
  getSummary(@Param('orderId') orderId: string) {
    return this.svc.getOrderValidationSummary(orderId);
  }
}
