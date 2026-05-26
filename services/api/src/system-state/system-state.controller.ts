import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { SystemStateService } from './system-state.service';

class ActivateSafeModeDto {
  reason: string;
}

@ApiTags('system-state')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/system-state')
export class SystemStateController {
  constructor(private readonly systemStateService: SystemStateService) {}

  @Get()
  @ApiOperation({
    summary: 'Evaluate system state',
    description:
      'Evaluates all 6 production gates from real database data and returns the current system state report.',
  })
  async getSystemState() {
    return this.systemStateService.evaluateState();
  }

  @Post('safe-mode/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate safe mode',
    description: 'Writes a system.safe_mode.activated event to the event log.',
  })
  @ApiBody({ type: ActivateSafeModeDto })
  async activateSafeMode(@Body() body: ActivateSafeModeDto) {
    await this.systemStateService.activateSafeMode(body.reason);
    return { ok: true, message: 'Safe mode activated', reason: body.reason };
  }

  @Post('safe-mode/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate safe mode',
    description: 'Writes a system.safe_mode.deactivated event to the event log.',
  })
  async deactivateSafeMode() {
    await this.systemStateService.deactivateSafeMode();
    return { ok: true, message: 'Safe mode deactivated' };
  }
}
