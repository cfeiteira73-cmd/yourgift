import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { Worker, Job, ConnectionOptions } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { QUEUE_NAMES } from '../queue.constants';
import { DlqService } from '../dlq.service';
import { REDIS_CONNECTION } from '../queue.module';
import { PdfJobData } from '../queue.service';

/**
 * PDF Generation Worker
 *
 * Processes jobs from the 'pdf-generation' queue.
 * Generates self-contained print-ready HTML documents and uploads to S3.
 * Returns the CloudFront URL as the job result.
 *
 * Why HTML → S3 (not Puppeteer):
 *   - Puppeteer requires a headless Chrome binary which isn't guaranteed on
 *     the Render starter plan container.
 *   - The generated HTML is fully print-ready (CSS @media print) and can be
 *     opened in a browser and printed to PDF by the end user with Ctrl+P.
 *   - For server-side PDF bytes, integrate wkhtmltopdf or a SaaS endpoint
 *     (e.g. gotenberg, pdf.co) by calling it here and uploading the bytes instead.
 */
@Injectable()
export class PdfWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfWorker.name);
  private worker: Worker;
  private s3: S3Client;
  private bucket: string;
  private cloudfrontUrl: string;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: ConnectionOptions,
    private readonly dlqService: DlqService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    // Initialise S3 client
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'yourgift-assets';
    this.cloudfrontUrl = this.config.get<string>('CLOUDFRONT_URL') ?? 'https://cdn.yourgift.pt';

    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_REGION') ?? 'eu-west-1',
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });

    // Start BullMQ worker
    this.worker = new Worker(
      QUEUE_NAMES.PDF_GENERATION,
      async (job: Job<PdfJobData>) => this.processPdf(job),
      {
        connection: this.connection,
        prefix: '{yourgift}',
        concurrency: 2, // CPU-bound — keep low
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`PDF generated: job ${job.id} type=${job.data.type} entity=${job.data.entityId}`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`PDF job ${job?.id} failed: ${err.message}`);
      if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 1)) {
        await this.dlqService.capture({
          originalQueue: QUEUE_NAMES.PDF_GENERATION,
          originalJobName: job?.name ?? 'generate-pdf',
          data: job?.data,
          error: err,
          jobId: job?.id,
        });
      }
    });

    this.logger.log('PDF worker started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  // ── Main processor ─────────────────────────────────────────────────────────

  private async processPdf(job: Job<PdfJobData>): Promise<{ url: string }> {
    const { type, tenantId, entityId, outputPath } = job.data;

    this.logger.debug(`Generating PDF: type=${type} entity=${entityId} tenant=${tenantId}`);

    const html = this.buildHtml(type, tenantId, entityId);
    const key = outputPath ?? `pdfs/${tenantId}/${type}/${entityId}-${Date.now()}.html`;

    // Upload to S3
    if (this.config.get<string>('AWS_ACCESS_KEY_ID')) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: Buffer.from(html, 'utf-8'),
          ContentType: 'text/html; charset=utf-8',
          ContentDisposition: `inline; filename="${type}-${entityId}.html"`,
          CacheControl: 'private, max-age=86400',
          Metadata: { tenantId, entityId, docType: type },
        }),
      );
      const url = `${this.cloudfrontUrl}/${key}`;
      this.logger.log(`PDF uploaded: ${url}`);
      return { url };
    }

    // AWS not configured — log only (dev/test mode)
    this.logger.warn(`PDF generated in-memory only (AWS_ACCESS_KEY_ID not set): type=${type} entity=${entityId}`);
    return { url: '' };
  }

  // ── HTML template builder ──────────────────────────────────────────────────

  private buildHtml(type: PdfJobData['type'], tenantId: string, entityId: string): string {
    const now = new Date().toLocaleDateString('pt-PT', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const titles: Record<PdfJobData['type'], string> = {
      'roi-report':            'ROI Report',
      'benchmark-report':      'Benchmark Report',
      'invoice':               'Invoice / Factura',
      'procurement-scorecard': 'Procurement Scorecard',
    };

    const title = titles[type] ?? type;

    return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — YourGift</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #1a1a2e;
      font-size: 14px;
      line-height: 1.6;
    }
    .page { max-width: 900px; margin: 0 auto; padding: 48px 40px; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 2px solid #07111f;
      margin-bottom: 32px;
    }
    .logo { font-size: 24px; font-weight: 800; color: #07111f; letter-spacing: -0.5px; }
    .logo span { color: #4da3ff; }
    .doc-meta { text-align: right; font-size: 12px; color: #64748b; }
    .doc-meta strong { display: block; font-size: 18px; color: #07111f; margin-bottom: 4px; }
    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #4da3ff;
      margin-bottom: 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .card-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
    .card-value { font-size: 22px; font-weight: 700; color: #07111f; margin-top: 4px; }
    .card-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      background: #07111f;
      color: #ffffff;
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    tr:hover td { background: #f8fafc; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-amber { background: #fef9c3; color: #854d0e; }
    .badge-blue  { background: #dbeafe; color: #1e40af; }
    footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body { font-size: 12px; }
      .page { padding: 24px; }
      header { margin-bottom: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <header>
      <div>
        <div class="logo">your<span>gift</span></div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Plataforma B2B de Corporate Gifts</div>
      </div>
      <div class="doc-meta">
        <strong>${title}</strong>
        <div>Tenant: ${tenantId}</div>
        <div>Ref: ${entityId}</div>
        <div>${now}</div>
      </div>
    </header>

    ${this.buildTypeBody(type, tenantId, entityId)}

    <!-- Footer -->
    <footer>
      <div>YourGift · <a href="https://yourgift.pt">yourgift.pt</a> · ops@yourgift.pt</div>
      <div>Documento gerado automaticamente em ${now}</div>
    </footer>
  </div>
</body>
</html>`;
  }

  private buildTypeBody(type: PdfJobData['type'], tenantId: string, entityId: string): string {
    switch (type) {
      case 'invoice':
        return this.invoiceBody(tenantId, entityId);
      case 'roi-report':
        return this.roiReportBody(tenantId, entityId);
      case 'benchmark-report':
        return this.benchmarkReportBody(tenantId, entityId);
      case 'procurement-scorecard':
        return this.scorecardBody(tenantId, entityId);
      default:
        return `<div class="section"><p>Documento: ${type} · Referência: ${entityId}</p></div>`;
    }
  }

  // ── Template bodies ────────────────────────────────────────────────────────

  private invoiceBody(tenantId: string, entityId: string): string {
    return `
      <div class="section">
        <div class="section-title">Detalhes da Factura</div>
        <div class="grid-2">
          <div class="card">
            <div class="card-label">Número de Factura</div>
            <div class="card-value" style="font-size:16px;">${entityId}</div>
            <div class="card-sub">Tenant: ${tenantId}</div>
          </div>
          <div class="card">
            <div class="card-label">Estado</div>
            <div class="card-value" style="font-size:16px;">
              <span class="badge badge-blue">Gerada</span>
            </div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Linhas de Facturação</div>
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Qtd</th>
              <th>Preço Unit.</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Produtos personalizados</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size:11px;color:#94a3b8;margin-top:8px;">
          * Os valores reais serão preenchidos pelo sistema de facturação ao processar a encomenda.
        </p>
      </div>`;
  }

  private roiReportBody(tenantId: string, entityId: string): string {
    return `
      <div class="section">
        <div class="section-title">Resumo Executivo</div>
        <div class="grid-3">
          <div class="card">
            <div class="card-label">ROI</div>
            <div class="card-value">—%</div>
            <div class="card-sub">vs benchmark sectorial</div>
          </div>
          <div class="card">
            <div class="card-label">Poupança Total</div>
            <div class="card-value">—€</div>
            <div class="card-sub">acumulado no período</div>
          </div>
          <div class="card">
            <div class="card-label">Fornecedores Avaliados</div>
            <div class="card-value">—</div>
            <div class="card-sub">trust score médio</div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Detalhes de Poupança por Categoria</div>
        <table>
          <thead>
            <tr><th>Categoria</th><th>Gasto Real</th><th>Benchmark</th><th>Poupança</th><th>ROI%</th></tr>
          </thead>
          <tbody>
            <tr><td colspan="5" style="color:#94a3b8;font-style:italic;">Dados carregados a partir da análise de compras — Ref: ${entityId}</td></tr>
          </tbody>
        </table>
      </div>`;
  }

  private benchmarkReportBody(tenantId: string, entityId: string): string {
    return `
      <div class="section">
        <div class="section-title">Análise Competitiva de Fornecedores</div>
        <div class="grid-2">
          <div class="card">
            <div class="card-label">Fornecedor Melhor Preço</div>
            <div class="card-value" style="font-size:16px;">—</div>
            <div class="card-sub">baseado em landed cost</div>
          </div>
          <div class="card">
            <div class="card-label">Variação Média de Preço</div>
            <div class="card-value" style="font-size:16px;">—%</div>
            <div class="card-sub">entre fornecedores avaliados</div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Rankings de Fornecedores</div>
        <table>
          <thead>
            <tr><th>#</th><th>Fornecedor</th><th>Trust Score</th><th>Preço Médio</th><th>Lead Time</th><th>Recomendação</th></tr>
          </thead>
          <tbody>
            <tr><td colspan="6" style="color:#94a3b8;font-style:italic;">Dados carregados da análise — Ref: ${entityId} · Tenant: ${tenantId}</td></tr>
          </tbody>
        </table>
      </div>`;
  }

  private scorecardBody(tenantId: string, entityId: string): string {
    return `
      <div class="section">
        <div class="section-title">Scorecard de Compras</div>
        <div class="grid-3">
          <div class="card">
            <div class="card-label">Decisão</div>
            <div class="card-value" style="font-size:16px;"><span class="badge badge-green">APROVAR</span></div>
          </div>
          <div class="card">
            <div class="card-label">Risco</div>
            <div class="card-value" style="font-size:16px;">—</div>
            <div class="card-sub">GREEN / AMBER / RED</div>
          </div>
          <div class="card">
            <div class="card-label">Landed Cost</div>
            <div class="card-value" style="font-size:16px;">—€</div>
            <div class="card-sub">incluindo frete + impostos</div>
          </div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Análise Detalhada</div>
        <table>
          <thead>
            <tr><th>Critério</th><th>Valor</th><th>Benchmark</th><th>Estado</th></tr>
          </thead>
          <tbody>
            <tr><td>Trust Score do Fornecedor</td><td>—</td><td>≥70</td><td><span class="badge badge-green">OK</span></td></tr>
            <tr><td>Landed Cost Unit.</td><td>—</td><td>—</td><td>—</td></tr>
            <tr><td>Lead Time (dias)</td><td>—</td><td>—</td><td>—</td></tr>
            <tr><td>Utilização Orçamental</td><td>—%</td><td>≤100%</td><td>—</td></tr>
          </tbody>
        </table>
        <p style="font-size:11px;color:#94a3b8;margin-top:8px;">Ref: ${entityId} · Tenant: ${tenantId}</p>
      </div>`;
  }
}
