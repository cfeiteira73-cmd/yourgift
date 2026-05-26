import { Module } from '@nestjs/common';
import { BusinessRealityController } from './business-reality.controller';
import { BusinessRealityEngine } from './business-reality.service';

@Module({
  controllers: [BusinessRealityController],
  providers: [BusinessRealityEngine],
  exports: [BusinessRealityEngine],
})
export class BusinessRealityModule {}
