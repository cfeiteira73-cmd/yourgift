import { Controller, Post, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { Request } from 'express';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    return this.payments.handleWebhook(req.rawBody!, signature);
  }
}
