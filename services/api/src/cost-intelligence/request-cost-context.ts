import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request query counter using AsyncLocalStorage.
 * Isolated from CostPerRequestInterceptor to avoid circular dependency
 * with PrismaService (which calls increment() via $use middleware).
 */
const queryCountStorage = new AsyncLocalStorage<{ count: number }>();

export class RequestCostContext {
  static setQueryCount(n: number): void {
    const store = queryCountStorage.getStore();
    if (store) store.count = n;
  }

  static getQueryCount(): number {
    return queryCountStorage.getStore()?.count ?? 0;
  }

  static increment(): void {
    const store = queryCountStorage.getStore();
    if (store) store.count += 1;
  }

  static run<T>(fn: () => T): T {
    return queryCountStorage.run({ count: 0 }, fn);
  }
}
