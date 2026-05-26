import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post(':sessionId/items')
  @ApiOperation({ summary: 'Add an item to cart (creates cart if none exists)' })
  addItem(@Param('sessionId') sessionId: string, @Body() dto: AddToCartDto) {
    return this.cart.addItem(sessionId, dto);
  }

  @Delete(':sessionId/items/:productId')
  @ApiOperation({ summary: 'Remove a product from cart' })
  @ApiQuery({ name: 'variantId', required: false })
  removeItem(
    @Param('sessionId') sessionId: string,
    @Param('productId') productId: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.cart.removeItem(sessionId, productId, variantId);
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get current cart state' })
  getCart(@Param('sessionId') sessionId: string) {
    return this.cart.getCart(sessionId);
  }

  @Delete(':sessionId')
  @ApiOperation({ summary: 'Clear all items from cart' })
  clearCart(@Param('sessionId') sessionId: string) {
    return this.cart.clearCart(sessionId);
  }

  @Post(':sessionId/checkout')
  @ApiOperation({ summary: 'Convert cart to an order and initiate checkout' })
  @ApiQuery({ name: 'clientId', required: true })
  @ApiQuery({ name: 'companyId', required: false })
  checkout(
    @Param('sessionId') sessionId: string,
    @Query('clientId') clientId: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.cart.checkout(sessionId, clientId, companyId);
  }
}
