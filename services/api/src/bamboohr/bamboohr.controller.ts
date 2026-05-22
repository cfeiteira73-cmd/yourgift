import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BambooHRService, BambooEmployee } from './bamboohr.service';

interface BambooWebhookBody {
  event?: string;
  type?: string;
  employee?: BambooEmployee;
  [key: string]: unknown;
}

@ApiTags('bamboohr')
@Controller('api/v1/bamboohr')
export class BambooHRController {
  constructor(
    private readonly bamboohrService: BambooHRService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Webhook endpoint called by BambooHR when a new employee is created.
   * Verify the shared secret via the `x-bamboohr-signature` header.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: BambooWebhookBody,
    @Headers('x-bamboohr-signature') signature: string,
  ) {
    const secret = this.config.get<string>('BAMBOOHR_WEBHOOK_SECRET');
    if (secret && signature !== secret) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // BambooHR sends employee data on hire/add events
    if (body?.event === 'employee.created' || body?.type === 'add') {
      const employee = (body.employee ?? body) as BambooEmployee;
      return this.bamboohrService.handleNewEmployee(employee);
    }

    return { acknowledged: true };
  }

  /**
   * List all employees from BambooHR (admin only).
   */
  @Get('employees')
  @UseGuards(JwtAuthGuard)
  getEmployees() {
    return this.bamboohrService.getEmployees();
  }
}
