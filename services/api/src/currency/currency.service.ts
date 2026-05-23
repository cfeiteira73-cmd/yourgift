import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STATIC_RATES: Record<string, number> = {
  'EUR-USD': 1.08,
  'EUR-GBP': 0.86,
  'EUR-BRL': 5.50,
  'EUR-CHF': 0.96,
  'EUR-CAD': 1.47,
  'EUR-AUD': 1.65,
};

@Injectable()
export class CurrencyService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyService.name);
  private ratesCache: Map<string, number> = new Map();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seedStaticRates();
      await this.loadRates();
    } catch (err) {
      this.logger.warn(`CurrencyService init failed (non-fatal): ${err}`);
    }
  }

  private async seedStaticRates() {
    const today = new Date();
    for (const [pair, rate] of Object.entries(STATIC_RATES)) {
      const parts = pair.split('-');
      const from = parts[0] ?? '';
      const to = parts[1] ?? '';
      await this.prisma.globalExchangeRate.upsert({
        where: { fromCurrency_toCurrency_rateDate: { fromCurrency: from, toCurrency: to, rateDate: today } },
        create: { fromCurrency: from, toCurrency: to, rate, rateDate: today, source: 'seed' },
        update: { rate },
      });
    }
  }

  private async loadRates() {
    const rates = await this.prisma.globalExchangeRate.findMany({
      orderBy: { rateDate: 'desc' },
    });
    this.ratesCache.clear();
    // Only keep latest rate per pair
    for (const r of rates) {
      const key = `${r.fromCurrency}-${r.toCurrency}`;
      if (!this.ratesCache.has(key)) {
        this.ratesCache.set(key, Number(r.rate));
      }
    }
  }

  convert(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    // Direct rate
    const direct = this.ratesCache.get(`${from}-${to}`);
    if (direct) return Math.round(amount * direct * 100) / 100;
    // Inverse rate
    const inverse = this.ratesCache.get(`${to}-${from}`);
    if (inverse) return Math.round((amount / inverse) * 100) / 100;
    // Through EUR
    const toEur = this.ratesCache.get(`${from}-EUR`) ?? 1;
    const fromEur = this.ratesCache.get(`EUR-${to}`) ?? 1;
    return Math.round(amount * toEur * fromEur * 100) / 100;
  }

  getSupportedCurrencies(): Array<{ code: string; symbol: string; name: string }> {
    return [
      { code: 'EUR', symbol: '€', name: 'Euro' },
      { code: 'USD', symbol: '$', name: 'US Dollar' },
      { code: 'GBP', symbol: '£', name: 'British Pound' },
      { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
      { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
      { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
      { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    ];
  }

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(amount);
  }

  async getRates() {
    return this.prisma.globalExchangeRate.findMany({ orderBy: { toCurrency: 'asc' } });
  }
}
