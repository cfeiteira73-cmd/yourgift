import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PolicyExecutionService, PolicyContext } from './policy-execution.service';

@ApiTags('policy-execution')
@UseGuards(JwtAuthGuard)
@Controller('policy')
export class PolicyExecutionController {
  constructor(private readonly policy: PolicyExecutionService) {}

  @Post('evaluate')
  @ApiOperation({ summary: 'Evaluate a policy decision — returns ALLOW/DENY/ESCALATE/STEP_UP' })
  async evaluate(@Body() ctx: PolicyContext) {
    return this.policy.evaluate(ctx);
  }
}
