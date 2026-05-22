import { Module } from '@nestjs/common';
import { HiBobService } from './hibob.service';
import { HiBobController } from './hibob.controller';

@Module({
  controllers: [HiBobController],
  providers: [HiBobService],
  exports: [HiBobService],
})
export class HiBobModule {}
