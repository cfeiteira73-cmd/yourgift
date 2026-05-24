import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

// ─── DTO ──────────────────────────────────────────────────────────────────────

class SendNotificationDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

// ─── interface ────────────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  user: { id: string; role?: string };
}

// ─── controller ───────────────────────────────────────────────────────────────

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // ── POST /notifications/send ──────────────────────────────────────────────

  @Post('send')
  @ApiOperation({ summary: 'Admin: enqueue a notification' })
  send(@Request() req: AuthRequest, @Body() dto: SendNotificationDto) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }
    return this.notifications.sendNotification(dto);
  }

  // ── GET /notifications/stats ───────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Admin: notification delivery statistics' })
  getStats(@Request() req: AuthRequest) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }
    // Stats are maintained in-memory in the service
    // In production these would come from a notification_logs table
    return {
      sentToday: 0,
      sentThisMonth: 0,
      failedToday: 0,
      templates: [
        { name: 'order_created', count: 0 },
        { name: 'order_paid', count: 0 },
        { name: 'order_shipped', count: 0 },
        { name: 'order_delivered', count: 0 },
      ],
    };
  }

  // ── GET /notifications/logs ────────────────────────────────────────────────

  @Get('logs')
  @ApiOperation({ summary: 'Admin: notification audit logs' })
  getLogs(@Request() req: AuthRequest) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }
    // Returns empty array until notification_logs table is added to schema
    // Logs are currently emitted to BetterStack via structured logging
    return [];
  }
}
