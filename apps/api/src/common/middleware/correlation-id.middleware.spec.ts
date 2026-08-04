import type { NextFunction, Response } from 'express';
import {
  correlationIdMiddleware,
  type RequestWithCorrelation,
} from './correlation-id.middleware';

describe('correlationIdMiddleware', () => {
  it('reuses inbound x-correlation-id', () => {
    const req = {
      headers: { 'x-correlation-id': ' inbound-id ' },
    } as unknown as RequestWithCorrelation;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toBe('inbound-id');
    expect(setHeader).toHaveBeenCalledWith('x-correlation-id', 'inbound-id');
    expect(next).toHaveBeenCalled();
  });

  it('generates a correlation id when missing', () => {
    const req = { headers: {} } as unknown as RequestWithCorrelation;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    correlationIdMiddleware(req, res, next);

    expect(req.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      req.correlationId,
    );
    expect(next).toHaveBeenCalled();
  });
});
