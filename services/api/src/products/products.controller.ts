import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'supplier', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query() query: { category?: string; supplier?: string; search?: string }) {
    return this.products.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }
}
