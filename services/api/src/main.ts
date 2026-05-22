import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── 1. CORS ─────────────────────────────────────────────────────────────────
  // Explicit allow-list; supports Vercel preview deployments via regex
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
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── 2. Shutdown hooks ───────────────────────────────────────────────────────
  app.enableShutdownHooks();

  // ── 3. Global validation pipe ───────────────────────────────────────────────
  // whitelist=true strips unknown fields; transform auto-coerces DTO types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── 4. Security headers (no external dep needed) ────────────────────────────
  const expressApp = app.getHttpAdapter().getInstance() as {
    use: (fn: (req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => void) => void;
    set: (key: string, value: unknown) => void;
  };

  expressApp.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // ── 5. Trust proxy (Render / Railway / Vercel reverse proxies) ──────────────
  expressApp.set('trust proxy', 1);

  // ── 6. Global prefix & Swagger ──────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('YourGift OS API')
    .setDescription('Production API for YourGift B2B Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`YourGift API running on port ${port}`);
}
bootstrap();
