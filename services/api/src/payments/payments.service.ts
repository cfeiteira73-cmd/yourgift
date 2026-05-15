import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private events: EventBusService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_KEY'), {
      apiVersion: '2023-10-16',
    });

    this.events.on('order.created', this.createCheckoutSession.bind(this));
  }

  async createCheckoutSession(order: any) {
    const items = order.items ?? [];

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
      price_data: {
        currency: 'eur',
        product_data: { name: `Product ${item.productId}` },
        unit_amount: Math.round(item.unitPrice * 100),
      },
      quantity: item.quantity,
    }));

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${this.config.get('NEXT_PUBLIC_API_URL')}/orders/${order.id}/success`,
      cancel_url: `${this.config.get('NEXT_PUBLIC_API_URL')}/orders/${order.id}/cancel`,
      metadata: { orderId: order.id },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.config.getOrThrow('STRIPE_WEBHOOK_SECRET');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'payment_confirmed', stripePaymentId: session.payment_intent as string },
        });
        this.events.emit('payment.confirmed', { orderId });
      }
    }

    return { received: true };
  }
}
