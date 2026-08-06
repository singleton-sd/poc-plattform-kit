import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const pino = {
    setContext: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  } as unknown as PinoLogger;
  const filter = new AllExceptionsFilter(pino);

  function createHost(statusPath = '/test') {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status };
    const request = {
      url: statusPath,
      method: 'GET',
      headers: { 'x-correlation-id': 'corr-1' },
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;

    return { host, json, status };
  }

  it('maps HttpException 4xx to warn response with correlationId', () => {
    const { host, json, status } = createHost();
    filter.catch(new HttpException('bad', HttpStatus.BAD_REQUEST), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(pino.warn).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        correlationId: 'corr-1',
      }),
    );
  });

  it('maps unknown errors to 500', () => {
    const { host, json, status } = createHost();
    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(pino.error).toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        correlationId: 'corr-1',
      }),
    );
  });
});
