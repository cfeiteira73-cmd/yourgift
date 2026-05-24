import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

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
  async getStats(@Request() req: AuthRequest) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [sentToday, sentThisMonth, failedToday, byTemplate] = await Promise.all([
      this.prisma.notificationLog.count({ where: { status: 'sent', sentAt: { gte: today } } }),
      this.prisma.notificationLog.count({ where: { status: 'sent', sentAt: { gte: monthStart } } }),
      this.prisma.notificationLog.count({ where: { status: 'failed', sentAt: { gte: today } } }),
      this.prisma.notificationLog.groupBy({
        by: ['template'],
        where: { template: { not: null } },
        _count: { template: true },
        orderBy: { _count: { template: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      sentToday,
      sentThisMonth,
      failedToday,
      templates: byTemplate.map((r) => ({ name: r.template, count: r._count.template })),
    };
  }

  // ── GET /notifications/logs ────────────────────────────────────────────────

  @Get('logs')
  @ApiOperation({ summary: 'Admin: notification audit logs (paginated)' })
  async getLogs(
    @Request() req: AuthRequest,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }

    const take = 50;
    const skip = Math.max(0, (parseInt(page ?? '1', 10) - 1)) * take;

    const where = status && status !== 'all' ? { status } : {};

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          to: true,
          subject: true,
          template: true,
          status: true,
          messageId: true,
          errorMessage: true,
          tenantId: true,
          referenceId: true,
          referenceType: true,
          sentAt: true,
        },
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return { logs, total, page: parseInt(page ?? '1', 10), pageSize: take };
  }
}
