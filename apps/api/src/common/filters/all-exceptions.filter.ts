import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const correlationId =
      (request.headers['x-correlation-id'] as string | undefined) ??
      (request as Request & { correlationId?: string }).correlationId;

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    const logCtx = {
      correlationId,
      path: request.url,
      method: request.method,
      statusCode: status,
      err: exception instanceof Error ? exception : undefined,
    };

    if (status >= 500) {
      this.logger.error(logCtx, 'Unhandled server error');
    } else {
      this.logger.warn(logCtx, 'Request failed');
    }

    response
      .status(status)
      .json(
        typeof payload === 'string'
          ? { statusCode: status, message: payload, correlationId }
          : { ...(payload as object), correlationId },
      );
  }
}
