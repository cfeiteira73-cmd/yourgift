import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    name: string;
    role: string;
    type: string;
  };
}

@Controller('api/v1/admin-auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() body: { email: string; password: string },
  ): Promise<{
    token: string;
    admin: { id: string; email: string; name: string; role: string };
  }> {
    return this.adminAuthService.login(body.email, body.password);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    createdAt: Date;
  }> {
    return this.adminAuthService.getProfile(req.user.sub);
  }

  @Get('admins')
  @UseGuards(JwtAuthGuard)
  listAdmins(): Promise<
    Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
    }>
  > {
    return this.adminAuthService.listAdmins();
  }
}
