import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateOrderDto) {
    return this.orders.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.orders.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.orders.findOne(id, req.user.id);
  }
}
