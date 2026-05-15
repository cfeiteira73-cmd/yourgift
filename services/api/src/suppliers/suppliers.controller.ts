import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuppliersService } from './suppliers.service';

@ApiTags('admin/suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/suppliers')
export class SuppliersController {
  constructor(private suppliers: SuppliersService) {}

  /** Trigger full Midocean catalogue sync */
  @Post('midocean/sync')
  syncMidocean() {
    return this.suppliers.syncMidocean();
  }
}
