import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { getRequestId } from '../middleware/correlation-id.middleware';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    path: string;
    method: string;
    ts: string;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const requestId = getRequestId();
    const meta = {
      requestId,
      path: req.url,
      method: req.method,
      ts: new Date().toISOString(),
    };

    // ── HTTP Exceptions (NestJS / manual throws) ──────────────────────────────
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exRes = exception.getResponse();
      const message =
        typeof exRes === 'string'
          ? exRes
          : (exRes as { message?: string | string[] }).message ?? exception.message;

      const body: ErrorResponse = {
        success: false,
        error: {
          code: `HTTP_${status}`,
          message: Array.isArray(message) ? message.join('; ') : String(message),
          ...(!this.isProd && { details: exRes }),
        },
        meta,
      };

      if (status >= 500) {
        this.logger.error(`[${requestId}] HTTP ${status} ${req.method} ${req.url}`, exception instanceof Error ? exception.stack : '');
      } else if (status >= 400) {
        this.logger.warn(`[${requestId}] HTTP ${status} ${req.method} ${req.url}: ${body.error.message}`);
      }

      res.status(status).json(body);
      return;
    }

    // ── Prisma Errors ──────────────────────────────────────────────────────────
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      let status = HttpStatus.INTERNAL_SERVER_ERROR;
      let message = 'Database error';
      let code = 'DB_ERROR';

      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'Resource already exists';
          code = 'DUPLICATE_ENTRY';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Resource not found';
          code = 'NOT_FOUND';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Related resource not found';
          code = 'FOREIGN_KEY_VIOLATION';
          break;
        case 'P2016':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          code = 'RECORD_NOT_FOUND';
          break;
      }

      this.logger.warn(`[${requestId}] Prisma ${exception.code}: ${exception.message}`);

      res.status(status).json({
        success: false,
        error: { code, message, ...(!this.isProd && { prismaCode: exception.code }) },
        meta,
      } satisfies ErrorResponse);
      return;
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn(`[${requestId}] Prisma validation error`);
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' },
        meta,
      } satisfies ErrorResponse);
      return;
    }

    // ── Unhandled / Unknown Errors ─────────────────────────────────────────────
    const err = exception instanceof Error ? exception : new Error(String(exception));

    this.logger.error(
      `[${requestId}] Unhandled exception: ${err.message}`,
      err.stack,
    );

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: this.isProd ? 'An unexpected error occurred' : err.message,
        ...(!this.isProd && { stack: err.stack }),
      },
      meta,
    } satisfies ErrorResponse);
  }
}
