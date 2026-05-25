import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  ProductionLearningLoopService,
  LearningCycle,
  SupplierScore,
  RoutingOptimization,
} from './production-learning-loop.service';

@Controller('admin/learning-loop')
@UseGuards(AdminAuthGuard)
export class LearningLoopController {
  constructor(private readonly learningLoop: ProductionLearningLoopService) {}

  @Post('run')
  runLearningCycle(): Promise<LearningCycle> {
    return this.learningLoop.runLearningCycle();
  }

  @Get('supplier/:supplierId')
  getSupplierScore(@Param('supplierId') supplierId: string): SupplierScore {
    const score = this.learningLoop.getSupplierScore(supplierId);
    if (!score) {
      throw new NotFoundException(`No score found for supplier ${supplierId}`);
    }
    return score;
  }

  @Get('suppliers')
  getRankedSuppliers(
    @Query('category') category?: string,
    @Query('limit') limitStr?: string,
  ): SupplierScore[] {
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    if (isNaN(limit) || limit < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.learningLoop.getRankedSuppliers(category, limit);
  }

  @Get('routing/:category')
  getRoutingOptimization(
    @Param('category') category: string,
  ): RoutingOptimization {
    const routing = this.learningLoop.getRoutingOptimization(category);
    if (!routing) {
      throw new NotFoundException(`No routing optimization found for category ${category}`);
    }
    return routing;
  }

  @Get('insights/:tenantId')
  generateInsights(
    @Param('tenantId') tenantId: string,
  ): Promise<
    Array<{
      type: string;
      message: string;
      impact: 'high' | 'medium' | 'low';
      supplierId?: string;
    }>
  > {
    return this.learningLoop.generateProcurementInsights(tenantId);
  }

  @Get('cycles')
  getLastCycles(@Query('limit') limitStr?: string): LearningCycle[] {
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    if (isNaN(limit) || limit < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.learningLoop.getLastCycles(limit);
  }
}
