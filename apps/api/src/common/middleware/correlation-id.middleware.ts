import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithCorrelation = Request & { correlationId?: string };

/**
 * Ensures every request has an x-correlation-id (or reuses an inbound one)
 * and exposes it on the request for logging / messaging.
 */
export function correlationIdMiddleware(
  req: RequestWithCorrelation,
  res: Response,
  next: NextFunction,
): void {
  const incoming =
    (req.headers['x-correlation-id'] as string | undefined)?.trim() ||
    (req.headers['traceparent'] as string | undefined)?.trim();

  const correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
  req.correlationId = correlationId;
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
