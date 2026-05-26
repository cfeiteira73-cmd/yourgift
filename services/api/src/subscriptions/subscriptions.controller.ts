import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
  Optional,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // ── POST /subscriptions ───────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a subscription for a tenant',
    description:
      'Creates or retrieves a Stripe customer, then creates a Stripe subscription ' +
      'with optional trial period. Persists the result and emits subscription.created.',
  })
  @ApiResponse({ status: 201, description: 'Subscription created.' })
  @ApiResponse({ status: 400, description: 'Duplicate active subscription or invalid input.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Tenant not found.' })
  createSubscription(@Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.createSubscription(dto);
  }

  // ── DELETE /subscriptions/:id ─────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a subscription',
    description:
      'Cancels a subscription immediately or at the end of the current billing period. ' +
      'Defaults to cancel_at_period_end (graceful). ' +
      'Pass `immediately=true` for instant termination.',
  })
  @ApiParam({ name: 'id', description: 'The subscription ID' })
  @ApiQuery({
    name: 'immediately',
    required: false,
    type: Boolean,
    description: 'If true, cancel immediately rather than at period end.',
  })
  @ApiResponse({ status: 200, description: 'Subscription canceled.' })
  @ApiResponse({ status: 400, description: 'Already canceled.' })
  @ApiResponse({ status: 404, description: 'Subscription not found.' })
  cancelSubscription(
    @Param('id') id: string,
    @Query('immediately', new ParseBoolPipe({ optional: true }))
    immediately?: boolean,
  ) {
    return this.subscriptionsService.cancelSubscription(id, immediately ?? false);
  }

  // ── GET /subscriptions/tenant/:tenantId ───────────────────────────────────

  @Get('tenant/:tenantId')
  @ApiOperation({
    summary: 'List all subscriptions for a tenant',
    description: 'Returns all subscriptions for the given tenant, newest first.',
  })
  @ApiParam({ name: 'tenantId', description: 'The tenant ID' })
  @ApiResponse({ status: 200, description: 'List of subscriptions.' })
  @ApiResponse({ status: 404, description: 'Tenant not found.' })
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.subscriptionsService.findByTenant(tenantId);
  }

  // ── GET /subscriptions/:id ────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get a subscription by ID',
  })
  @ApiParam({ name: 'id', description: 'The subscription ID' })
  @ApiResponse({ status: 200, description: 'Subscription record.' })
  @ApiResponse({ status: 404, description: 'Subscription not found.' })
  findById(@Param('id') id: string) {
    return this.subscriptionsService.findById(id);
  }
}
