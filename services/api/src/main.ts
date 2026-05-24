import 'reflect-metadata';
import { initSentry } from './observability/sentry.config';
// Sentry MUST be initialised before any other import that touches instrumentation
initSentry();

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Disable default logger in production — use structured LoggingInterceptor instead
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'debug', 'error', 'warn', 'verbose'],
    bufferLogs: true,
  });

  // ── 1. Trust proxy (Render / Vercel / Cloudflare reverse proxies) ──────────
  app.set('trust proxy', 1);

  // ── 2. Correlation ID Middleware (must be first) ───────────────────────────
  // Generates X-Request-ID per request for distributed tracing
  const correlationMiddleware = new CorrelationIdMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) =>
    correlationMiddleware.use(req, res, next),
  );

  // ── 3. Security Headers ───────────────────────────────────────────────────
  app.use((_req: Request, res: Response, next: NextFunction) => {
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Clickjacking protection
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy — minimal surface
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

    // HSTS — 1 year, include subdomains
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // CSP — strict for API, allows Swagger UI in non-prod
    const csp =
      process.env.NODE_ENV === 'production'
        ? "default-src 'none'; frame-ancestors 'none'"
        : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:";
    res.setHeader('Content-Security-Policy', csp);

    // Remove fingerprinting headers
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  });

  // ── 4. CORS ───────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      'https://admin.yourgift.pt',
      'https://www.yourgift.pt',
      'https://yourgift.pt',
      /\.vercel\.app$/,
      ...(process.env.NODE_ENV !== 'production'
        ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
        : []),
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Correlation-ID'],
    exposedHeaders: ['X-Request-ID', 'X-Correlation-ID'],
    credentials: true,
  });

  // ── 5. Shutdown hooks ─────────────────────────────────────────────────────
  app.enableShutdownHooks();

  // ── 6. Global Exception Filter ───────────────────────────────────────────
  // Catches ALL exceptions — no raw stack traces in production
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── 7. Global Interceptors ───────────────────────────────────────────────
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(
    new LoggingInterceptor(),                    // Structured request/response logs
    new ClassSerializerInterceptor(reflector),   // @Exclude() / @Transform() on entities
    new TransformInterceptor(),                  // Consistent { success, data, meta } envelope
  );

  // ── 8. Global Validation Pipe ────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strip unknown properties
      forbidNonWhitelisted: true,   // Reject requests with unknown properties
      transform: true,              // Auto-coerce types (string→number etc.)
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,      // Return all validation errors at once
    }),
  );

  // ── 9. Global Prefix ─────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── 10. Swagger (non-production only) ────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('YourGift OS API')
      .setDescription('Production API for YourGift B2B Procurement Platform')
      .setVersion('2.0')
      .addBearerAuth()
      .addServer('http://localhost:3001', 'Local')
      .addServer('https://yourgift-api.onrender.com', 'Production')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log('Swagger available at /docs');
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`YourGift API running on port ${port} [${process.env.NODE_ENV ?? 'development'}]`);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.fatal(`Failed to start: ${(err as Error).message}`, (err as Error).stack);
  process.exit(1);
});
