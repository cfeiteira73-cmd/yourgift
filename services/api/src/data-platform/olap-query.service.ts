import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OlapQuery {
  measures: string[];
  dimensions: string[];
  filters?: Record<string, string>;
  from: Date;
  to: Date;
  limit?: number;
}

export interface OlapResult {
  columns: string[];
  rows: Record<string, unknown>[];
  executionMs: number;
  rowCount: number;
}

export interface SavedQuery {
  id: string;
  name: string;
  description: string;
  query: object;
}

// ─── Allowed dimensions and measures (allowlist for SQL injection prevention) ─

const ALLOWED_MEASURES = new Set([
  'order_count',
  'spend',
  'margin',
  'lead_time',
  'savings',
]);

const ALLOWED_DIMENSIONS = new Set([
  'tenant',
  'supplier',
  'category',
  'carrier',
  'region',
  'period',
]);

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OlapQueryService {
  private readonly logger = new Logger(OlapQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runQuery(query: OlapQuery): Promise<OlapResult> {
    const start = Date.now();

    // Validate measures and dimensions against allowlist
    const validMeasures = query.measures.filter((m) => ALLOWED_MEASURES.has(m));
    const validDimensions = query.dimensions.filter((d) => ALLOWED_DIMENSIONS.has(d));

    if (validMeasures.length === 0 && validDimensions.length === 0) {
      return {
        columns: [],
        rows: [],
        executionMs: Date.now() - start,
        rowCount: 0,
      };
    }

    const limit = Math.min(query.limit ?? 1000, 5000);

    try {
      const rows = await this.buildAndExecuteQuery(
        validMeasures,
        validDimensions,
        query.filters ?? {},
        query.from,
        query.to,
        limit,
      );

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [...validDimensions, ...validMeasures];

      return {
        columns,
        rows,
        executionMs: Date.now() - start,
        rowCount: rows.length,
      };
    } catch (err) {
      this.logger.warn(`OlapQuery error: ${String(err)}`);
      return {
        columns: [],
        rows: [],
        executionMs: Date.now() - start,
        rowCount: 0,
      };
    }
  }

  private async buildAndExecuteQuery(
    measures: string[],
    dimensions: string[],
    filters: Record<string, string>,
    from: Date,
    to: Date,
    limit: number,
  ): Promise<Record<string, unknown>[]> {
    // Map dimensions to SQL expressions
    const selectParts: string[] = [];
    const groupParts: string[] = [];

    for (const dim of dimensions) {
      switch (dim) {
        case 'tenant':
          selectParts.push("o.tenant_id AS \"tenant\"");
          groupParts.push('o.tenant_id');
          break;
        case 'supplier':
          selectParts.push("COALESCE(o.supplier, 'unknown') AS \"supplier\"");
          groupParts.push('o.supplier');
          break;
        case 'category':
          selectParts.push("COALESCE(p.category, 'unknown') AS \"category\"");
          groupParts.push('p.category');
          break;
        case 'carrier':
          selectParts.push("COALESCE(o.supplier, 'unknown') AS \"carrier\"");
          groupParts.push('o.supplier');
          break;
        case 'region':
          selectParts.push("COALESCE(o.tenant_id, 'unknown') AS \"region\"");
          groupParts.push('o.tenant_id');
          break;
        case 'period':
          selectParts.push("to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS \"period\"");
          groupParts.push("date_trunc('month', o.created_at)");
          break;
      }
    }

    for (const measure of measures) {
      switch (measure) {
        case 'order_count':
          selectParts.push('COUNT(DISTINCT o.id)::bigint AS "order_count"');
          break;
        case 'spend':
          selectParts.push('COALESCE(SUM(o.total_amount), 0)::float AS "spend"');
          break;
        case 'margin':
          selectParts.push('COALESCE(SUM(o.margin_amount), 0)::float AS "margin"');
          break;
        case 'lead_time':
          selectParts.push(
            'AVG(EXTRACT(EPOCH FROM (o.delivered_at - o.created_at)) / 86400)::float AS "lead_time"',
          );
          break;
        case 'savings':
          selectParts.push(
            'COALESCE(SUM(oi.unit_cost * oi.quantity), 0)::float AS "savings"',
          );
          break;
      }
    }

    if (selectParts.length === 0) return [];

    // Build WHERE conditions (static — no user input in SQL identifiers)
    const whereClauses: string[] = [
      `o.created_at >= '${from.toISOString()}'`,
      `o.created_at <= '${to.toISOString()}'`,
    ];

    if (filters['tenant']) {
      // Sanitize: only allow alphanumeric + hyphens
      const safe = filters['tenant'].replace(/[^a-zA-Z0-9_-]/g, '');
      if (safe) whereClauses.push(`o.tenant_id = '${safe}'`);
    }
    if (filters['supplier']) {
      const safe = filters['supplier'].replace(/[^a-zA-Z0-9_-]/g, '');
      if (safe) whereClauses.push(`o.supplier = '${safe}'`);
    }

    const needsItemJoin =
      measures.includes('savings') || dimensions.includes('category');
    const joinClause = needsItemJoin
      ? `LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN products p ON p.id = oi.product_id`
      : `LEFT JOIN order_items oi ON oi.order_id = o.id
         LEFT JOIN products p ON p.id = oi.product_id`;

    const groupClause = groupParts.length > 0 ? `GROUP BY ${groupParts.join(', ')}` : '';
    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const sql = `
      SELECT ${selectParts.join(', ')}
      FROM orders o
      ${joinClause}
      ${whereClause}
      ${groupClause}
      ORDER BY 1
      LIMIT ${limit}
    `;

    const result = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql);
    return result.map((row) => {
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        clean[k] = typeof v === 'bigint' ? Number(v) : v;
      }
      return clean;
    });
  }

  getSavedQueries(): SavedQuery[] {
    return [
      {
        id: 'cfo-spend-by-month',
        name: 'CFO Spend by Month',
        description: 'Monthly procurement spend breakdown for CFO reporting',
        query: {
          measures: ['order_count', 'spend', 'margin'],
          dimensions: ['period'],
          from: new Date(Date.now() - 365 * 86_400_000).toISOString(),
          to: new Date().toISOString(),
          limit: 24,
        },
      },
      {
        id: 'supplier-performance',
        name: 'Supplier Performance',
        description: 'Order count, spend, and lead time by supplier',
        query: {
          measures: ['order_count', 'spend', 'lead_time'],
          dimensions: ['supplier'],
          from: new Date(Date.now() - 90 * 86_400_000).toISOString(),
          to: new Date().toISOString(),
          limit: 50,
        },
      },
      {
        id: 'category-analysis',
        name: 'Category Analysis',
        description: 'Spend and order volume broken down by product category',
        query: {
          measures: ['order_count', 'spend', 'savings'],
          dimensions: ['category'],
          from: new Date(Date.now() - 90 * 86_400_000).toISOString(),
          to: new Date().toISOString(),
          limit: 100,
        },
      },
      {
        id: 'tenant-comparison',
        name: 'Tenant Spend Comparison',
        description: 'Compare procurement spend across all tenants',
        query: {
          measures: ['order_count', 'spend'],
          dimensions: ['tenant'],
          from: new Date(Date.now() - 30 * 86_400_000).toISOString(),
          to: new Date().toISOString(),
          limit: 200,
        },
      },
      {
        id: 'period-supplier-pivot',
        name: 'Period × Supplier Pivot',
        description: 'Cross-tabulation of monthly spend by supplier',
        query: {
          measures: ['order_count', 'spend'],
          dimensions: ['period', 'supplier'],
          from: new Date(Date.now() - 180 * 86_400_000).toISOString(),
          to: new Date().toISOString(),
          limit: 500,
        },
      },
    ];
  }
}
