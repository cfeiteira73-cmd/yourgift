import { Controller, Post, Body, UseGuards, Request, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(200)
  async login(@Request() req: any) {
    return this.auth.login(req.user);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const passwordHash = await this.auth.hashPassword(dto.password);
    const client = await this.prisma.client.create({
      data: { email: dto.email, name: dto.name, company: dto.company, passwordHash },
    });
    return this.auth.login(client);
  }
}
