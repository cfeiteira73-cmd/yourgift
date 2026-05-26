import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('YourGift OS API')
    .setDescription('Enterprise procurement, commerce, and financial operating system')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('orders', 'Order lifecycle management')
    .addTag('payments', 'Payment processing (Stripe)')
    .addTag('refunds', 'Refund management')
    .addTag('subscriptions', 'Subscription management')
    .addTag('quotes', 'Quote management')
    .addTag('approvals', 'Approval workflows')
    .addTag('procurement', 'Procurement engine')
    .addTag('ledger', 'Financial ledger')
    .addTag('reconciliation', 'Financial reconciliation')
    .addTag('suppliers', 'Supplier management')
    .addTag('auth', 'Authentication & authorization')
    .addTag('admin', 'Admin control plane')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outputPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');
  console.log(`OpenAPI spec exported to ${outputPath}`);
  console.log(`  Paths: ${Object.keys(document.paths).length}`);
  console.log(`  Schemas: ${Object.keys(document.components?.schemas ?? {}).length}`);

  await app.close();
}

exportOpenApi().catch((err: unknown) => {
  console.error('Failed to export OpenAPI spec:', err);
  process.exit(1);
});
