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

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private quotes: QuotesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new quote (RFQ)' })
  create(@Request() req: any, @Body() dto: CreateQuoteDto) {
    return this.quotes.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all quotes for authenticated client' })
  findAll(@Request() req: any) {
    return this.quotes.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get quote detail' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.quotes.findOne(id, req.user.id);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit quote for pricing (draft → submitted)' })
  submit(@Request() req: any, @Param('id') id: string) {
    return this.quotes.submit(id, req.user.id);
  }

  @Post(':id/price')
  @ApiOperation({ summary: 'Trigger pricing calculation (submitted → approved)' })
  calculatePricing(@Param('id') id: string) {
    return this.quotes.calculatePricing(id);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convert approved quote to order (approved → converted)' })
  convert(@Param('id') id: string) {
    return this.quotes.convert(id);
  }
}
