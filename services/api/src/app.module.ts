import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { PricingModule } from './pricing/pricing.module';
import { PaymentsModule } from './payments/payments.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ArtworkModule } from './artwork/artwork.module';
import { PrismaModule } from './prisma/prisma.module';
import { EventBusModule } from './events/event-bus.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    EventBusModule,
    HealthModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    PricingModule,
    PaymentsModule,
    SuppliersModule,
    ArtworkModule,
  ],
})
export class AppModule {}
