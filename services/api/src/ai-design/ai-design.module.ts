import { Module } from '@nestjs/common';
import { AIDesignService } from './ai-design.service';
import { BrandTemplateService } from './brand-template.service';
import { ZeroFrictionService } from './zero-friction.service';
import { AIDesignController } from './ai-design.controller';

@Module({
  controllers: [AIDesignController],
  providers: [AIDesignService, BrandTemplateService, ZeroFrictionService],
  exports: [AIDesignService, BrandTemplateService, ZeroFrictionService],
})
export class AIDesignModule {}
