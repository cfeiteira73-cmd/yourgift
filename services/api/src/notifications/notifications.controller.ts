import {
  Controller,
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
  @ApiOperation({ summary: 'Admin: enqueue a notification (stub — Resend integration pending)' })
  send(@Request() req: AuthRequest, @Body() dto: SendNotificationDto) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }
    return this.notifications.sendNotification(dto);
  }
}
