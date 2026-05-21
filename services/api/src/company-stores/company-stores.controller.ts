import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CompanyStoresService } from './company-stores.service';
import { CreateCompanyStoreDto } from './dto/create-company-store.dto';
import { UpdateCompanyStoreDto } from './dto/update-company-store.dto';
import { AddProductDto } from './dto/add-product.dto';

@ApiTags('company-stores')
@Controller('company-stores')
export class CompanyStoresController {
  constructor(private readonly stores: CompanyStoresService) {}

  // ── GET /company-stores/slug/:slug — PUBLIC, no auth ─────────────────────

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Public storefront by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.stores.findBySlug(slug);
  }

  // ── GET /company-stores/company/:companyId ────────────────────────────────

  @Get('company/:companyId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List stores for a company' })
  findForCompany(@Param('companyId') companyId: string) {
    return this.stores.findForCompany(companyId);
  }

  // ── GET /company-stores/analytics/:companyId ──────────────────────────────

  @Get('analytics/:companyId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Store analytics for a company' })
  getAnalytics(@Param('companyId') companyId: string) {
    return this.stores.getAnalytics(companyId);
  }

  // ── POST /company-stores ───────────────────────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a company store' })
  create(@Body() dto: CreateCompanyStoreDto) {
    return this.stores.create(dto);
  }

  // ── GET /company-stores/:id ────────────────────────────────────────────────

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Admin store detail' })
  findOne(@Param('id') id: string) {
    return this.stores.findOne(id);
  }

  // ── PATCH /company-stores/:id ──────────────────────────────────────────────

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update store config' })
  update(@Param('id') id: string, @Body() dto: UpdateCompanyStoreDto) {
    return this.stores.update(id, dto);
  }

  // ── POST /company-stores/:id/products ─────────────────────────────────────

  @Post(':id/products')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add a product to the store' })
  addProduct(@Param('id') id: string, @Body() dto: AddProductDto) {
    return this.stores.addProduct(id, dto.productId, dto.customPrice, dto.sortOrder);
  }

  // ── DELETE /company-stores/:id/products/:productId ────────────────────────

  @Delete(':id/products/:productId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a product from the store' })
  removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    return this.stores.removeProduct(id, productId);
  }

  // ── GET /company-stores/:id/products ──────────────────────────────────────

  @Get(':id/products')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List products in store with custom prices' })
  getProducts(@Param('id') id: string) {
    return this.stores.getProducts(id);
  }

  // ── POST /company-stores/:id/activate ─────────────────────────────────────

  @Post(':id/activate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Activate store' })
  activate(@Param('id') id: string) {
    return this.stores.activate(id);
  }

  // ── POST /company-stores/:id/deactivate ───────────────────────────────────

  @Post(':id/deactivate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Deactivate store' })
  deactivate(@Param('id') id: string) {
    return this.stores.deactivate(id);
  }
}
