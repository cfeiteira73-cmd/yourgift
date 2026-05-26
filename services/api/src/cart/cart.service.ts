import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

export interface CartItem {
  productId: string;
  variantId?: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

export interface CartState {
  sessionId: string;
  items: CartItem[];
  totalItems: number;
  totalAmount: number;
  currency: string;
  updatedAt: Date;
}

/**
 * Cart state is stored in a per-process in-memory Map keyed by sessionId.
 * This is intentional for a free-tier / single-instance deployment.
 * For multi-instance deployments, replace this Map with a Redis-backed
 * adapter (e.g. store serialised CartState in a Redis key `cart:{sessionId}`).
 */
const cartStore = new Map<string, CartItem[]>();

function buildCartState(sessionId: string, items: CartItem[]): CartState {
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  return {
    sessionId,
    items,
    totalItems,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    currency: 'EUR',
    updatedAt: new Date(),
  };
}

function buildOrderRef(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `YGO-${datePart}-${rand}`;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  async addItem(sessionId: string, dto: AddToCartDto): Promise<CartState> {
    // Validate product exists and get pricing
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { variants: true },
    });
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found`);

    let unitPrice = product.basePrice;

    if (dto.variantId) {
      const variant = product.variants.find((v) => v.id === dto.variantId);
      if (!variant) {
        throw new NotFoundException(
          `Variant ${dto.variantId} not found for product ${dto.productId}`,
        );
      }
      unitPrice = variant.price ?? product.basePrice;
    }

    const items = cartStore.get(sessionId) ?? [];

    // Merge quantities if same productId + variantId combination
    const existingIndex = items.findIndex(
      (i) => i.productId === dto.productId && i.variantId === dto.variantId,
    );

    if (existingIndex >= 0) {
      items[existingIndex].quantity += dto.quantity;
    } else {
      items.push({
        productId: dto.productId,
        variantId: dto.variantId,
        productName: product.title,
        unitPrice,
        quantity: dto.quantity,
      });
    }

    cartStore.set(sessionId, items);
    return buildCartState(sessionId, items);
  }

  async removeItem(
    sessionId: string,
    productId: string,
    variantId?: string,
  ): Promise<CartState> {
    const items = cartStore.get(sessionId) ?? [];

    const filtered = items.filter(
      (i) =>
        !(i.productId === productId && i.variantId === variantId),
    );

    cartStore.set(sessionId, filtered);
    return buildCartState(sessionId, filtered);
  }

  async getCart(sessionId: string): Promise<CartState> {
    const items = cartStore.get(sessionId) ?? [];
    return buildCartState(sessionId, items);
  }

  async clearCart(sessionId: string): Promise<void> {
    cartStore.delete(sessionId);
  }

  async checkout(
    sessionId: string,
    clientId: string,
    companyId?: string,
  ): Promise<{ orderId: string; checkoutUrl: string }> {
    const items = cartStore.get(sessionId) ?? [];

    if (items.length === 0) {
      throw new BadRequestException('Cart is empty — add items before checking out');
    }

    // Fetch first variant for each item to satisfy Order model FK requirement
    const orderItems = await Promise.all(
      items.map(async (item) => {
        let variantId = item.variantId;
        if (!variantId) {
          const variant = await this.prisma.productVariant.findFirst({
            where: { productId: item.productId },
            orderBy: { stock: 'desc' },
          });
          if (!variant) {
            throw new BadRequestException(
              `No variant found for product ${item.productId}. Cannot create order.`,
            );
          }
          variantId = variant.id;
        }
        return {
          productId: item.productId,
          variantId,
          quantity: item.quantity,
          unitCost: item.unitPrice,
          unitPrice: item.unitPrice,
          printCost: 0,
        };
      }),
    );

    const totalAmount = items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0,
    );

    const ref = buildOrderRef();

    const order = await this.prisma.order.create({
      data: {
        ref,
        clientId,
        companyId: companyId ?? undefined,
        status: 'created',
        shippingAddress: {} as Prisma.InputJsonValue,
        pricingSnapshot: {} as Prisma.InputJsonValue,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        items: { create: orderItems },
      },
      include: { items: true },
    });

    await this.prisma.eventLog.create({
      data: {
        entity: 'order',
        entityId: order.id,
        event: 'order.created',
        actorId: clientId,
        actorType: 'client',
        payload: {
          ref: order.ref,
          source: 'cart_checkout',
          sessionId,
          itemCount: items.length,
          totalAmount,
        },
        orderId: order.id,
      },
    });

    this.events.emit('order.created', order);

    // Clear cart after successful order creation
    cartStore.delete(sessionId);

    return {
      orderId: order.id,
      checkoutUrl: `/checkout/${order.id}`,
    };
  }
}
