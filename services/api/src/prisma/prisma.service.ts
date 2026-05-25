import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RequestCostContext } from '../cost-intelligence/cost-per-request.interceptor';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // Prisma middleware: increment per-request query counter for cost attribution.
    // Uses AsyncLocalStorage set by CostPerRequestInterceptor — safe to call outside
    // a request context (storage.getStore() returns undefined and increment() is a no-op).
    this.$use(async (params, next) => {
      RequestCostContext.increment();
      return next(params);
    });

    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
