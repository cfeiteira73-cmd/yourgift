import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Currency, GlobalExchangeRate } from '@prisma/client';

@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  // Convert amount from one currency to another using latest rate
  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;

    // Try direct rate
    const direct = await this.prisma.globalExchangeRate.findFirst({
      where: { fromCurrency: from, toCurrency: to },
      orderBy: { rateDate: 'desc' },
    });
    if (direct) return amount * Number(direct.rate);

    // Try inverse rate
    const inverse = await this.prisma.globalExchangeRate.findFirst({
      where: { fromCurrency: to, toCurrency: from },
      orderBy: { rateDate: 'desc' },
    });
    if (inverse) return amount / Number(inverse.rate);

    // Try via EUR
    const toEurRate = await this.prisma.globalExchangeRate.findFirst({
      where: { fromCurrency: from, toCurrency: 'EUR' },
      orderBy: { rateDate: 'desc' },
    });
    const eurToRate = await this.prisma.globalExchangeRate.findFirst({
      where: { fromCurrency: 'EUR', toCurrency: to },
      orderBy: { rateDate: 'desc' },
    });

    if (toEurRate && eurToRate) {
      const amountInEur = amount * Number(toEurRate.rate);
      return amountInEur * Number(eurToRate.rate);
    }

    // If from is EUR, try EUR→to directly
    if (from === 'EUR' && eurToRate) {
      return amount * Number(eurToRate.rate);
    }

    // If to is EUR, try from→EUR directly
    if (to === 'EUR' && toEurRate) {
      return amount * Number(toEurRate.rate);
    }

    throw new NotFoundException(`No conversion path found from ${from} to ${to}`);
  }

  // Format amount with currency symbol
  format(amount: number, currencyCode: string): string {
    const CURRENCY_MAP: Record<string, { symbol: string; decimals: number }> = {
      EUR: { symbol: '€', decimals: 2 },
      USD: { symbol: '$', decimals: 2 },
      GBP: { symbol: '£', decimals: 2 },
      CHF: { symbol: 'CHF', decimals: 2 },
      PLN: { symbol: 'zł', decimals: 2 },
      CZK: { symbol: 'Kč', decimals: 2 },
      SEK: { symbol: 'kr', decimals: 2 },
      DKK: { symbol: 'kr', decimals: 2 },
      NOK: { symbol: 'kr', decimals: 2 },
      HUF: { symbol: 'Ft', decimals: 0 },
    };
    const cfg = CURRENCY_MAP[currencyCode] ?? { symbol: currencyCode, decimals: 2 };
    return `${cfg.symbol}${amount.toFixed(cfg.decimals)}`;
  }

  // Get all active currencies
  async getCurrencies(): Promise<Currency[]> {
    return this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  // Get latest exchange rates for a base currency
  async getLatestRates(
    baseCurrency = 'EUR',
  ): Promise<Array<{ currency: string; rate: number; symbol: string }>> {
    const rates = await this.prisma.globalExchangeRate.findMany({
      where: { fromCurrency: baseCurrency },
      orderBy: { rateDate: 'desc' },
    });

    // Deduplicate: keep only latest per toCurrency
    const seen = new Set<string>();
    const dedupedRates: GlobalExchangeRate[] = [];
    for (const r of rates) {
      if (!seen.has(r.toCurrency)) {
        seen.add(r.toCurrency);
        dedupedRates.push(r);
      }
    }

    const currencies = await this.prisma.currency.findMany({ where: { isActive: true } });
    const symbolMap: Record<string, string> = {};
    for (const c of currencies) {
      symbolMap[c.code] = c.symbol;
    }

    return dedupedRates.map((r) => ({
      currency: r.toCurrency,
      rate: Number(r.rate),
      symbol: symbolMap[r.toCurrency] ?? r.toCurrency,
    }));
  }

  // Upsert an exchange rate and its inverse
  async updateRate(
    from: string,
    to: string,
    rate: number,
    source = 'manual',
  ): Promise<GlobalExchangeRate> {
    const today = new Date();

    const inverseRate = 1 / rate;

    const [result] = await Promise.all([
      this.prisma.globalExchangeRate.upsert({
        where: { fromCurrency_toCurrency_rateDate: { fromCurrency: from, toCurrency: to, rateDate: today } },
        create: { fromCurrency: from, toCurrency: to, rate, rateDate: today, source },
        update: { rate, source },
      }),
      this.prisma.globalExchangeRate.upsert({
        where: { fromCurrency_toCurrency_rateDate: { fromCurrency: to, toCurrency: from, rateDate: today } },
        create: { fromCurrency: to, toCurrency: from, rate: inverseRate, rateDate: today, source: `${source}_inverse` },
        update: { rate: inverseRate, source: `${source}_inverse` },
      }),
    ]);

    return result;
  }

  // Build N×N conversion matrix for all active currencies via EUR
  async getConversionMatrix(): Promise<Record<string, Record<string, number>>> {
    const currencies = await this.prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const codes = currencies.map((c) => c.code);

    const matrix: Record<string, Record<string, number>> = {};

    for (const from of codes) {
      const row: Record<string, number> = {};
      matrix[from] = row;
      for (const to of codes) {
        if (from === to) {
          row[to] = 1;
          continue;
        }
        try {
          row[to] = await this.convert(1, from, to);
        } catch {
          row[to] = 0;
        }
      }
    }

    return matrix;
  }
}
