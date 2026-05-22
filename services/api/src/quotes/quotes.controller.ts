import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { RequestQuoteDto } from './dto/request-quote.dto';

@ApiTags('quotes')
@Controller('quotes')
export class QuotesController {
  constructor(private quotes: QuotesService) {}

  // ── Public endpoint — no auth required ──────────────────────────────────

  @Post('request')
  @ApiOperation({ summary: 'Submit a public quote request form (no auth)' })
  requestQuote(@Body() dto: RequestQuoteDto) {
    return this.quotes.requestQuote(dto);
  }

  // ── Authenticated endpoints ──────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a new quote (RFQ)' })
  create(@Request() req: any, @Body() dto: CreateQuoteDto) {
    return this.quotes.create(req.user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List all quotes for authenticated client' })
  findAll(@Request() req: any) {
    return this.quotes.findAll(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get quote detail' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.quotes.findOne(id, req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit quote for pricing (draft → submitted)' })
  submit(@Request() req: any, @Param('id') id: string) {
    return this.quotes.submit(id, req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/price')
  @ApiOperation({ summary: 'Trigger pricing calculation (submitted → approved)' })
  calculatePricing(@Param('id') id: string) {
    return this.quotes.calculatePricing(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/convert')
  @ApiOperation({ summary: 'Convert approved quote to order (approved → converted)' })
  convert(@Param('id') id: string) {
    return this.quotes.convert(id);
  }
}
