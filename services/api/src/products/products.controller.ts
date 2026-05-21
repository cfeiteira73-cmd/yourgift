import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products with filtering, search and pagination' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false, description: 'Midocean category code prefix (e.g. MOBTEX)' })
  @ApiQuery({ name: 'categoryGroup', required: false, description: 'UI group: apparel|bags|drinkware|office|tech|writing|leisure|personal|tools|stationery|kitchen|seasonal' })
  @ApiQuery({ name: 'supplier', required: false })
  @ApiQuery({ name: 'minPrice', required: false })
  @ApiQuery({ name: 'maxPrice', required: false })
  @ApiQuery({ name: 'inStock', required: false })
  @ApiQuery({ name: 'eco', required: false, description: 'Filter eco/sustainable products' })
  @ApiQuery({ name: 'sort', required: false, enum: ['newest', 'price_asc', 'price_desc', 'name_asc'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('categoryGroup') categoryGroup?: string,
    @Query('supplier') supplier?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('inStock') inStock?: string,
    @Query('eco') eco?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.products.findAll({
      search,
      category,
      categoryGroup,
      supplier,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      inStock: inStock === 'true',
      eco: eco === 'true',
      sort: sort as any,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 24,
    });
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get product categories grouped for UI display' })
  getCategories() {
    return this.products.getCategories();
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured products with stock' })
  getFeatured() {
    return this.products.getFeatured();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get catalog statistics' })
  getStats() {
    return this.products.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by UUID or supplierRef' })
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }
}
