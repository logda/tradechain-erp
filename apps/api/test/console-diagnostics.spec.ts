import { BadRequestException, Logger, type ArgumentsHost } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConsoleExceptionFilter, logHttpRequest } from '../src/common/console-diagnostics';

describe('server console diagnostics', () => {
  afterEach(() => jest.restoreAllMocks());

  it('logs request outcome without query strings, headers or body', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    let finish: () => void = () => undefined;
    const next = jest.fn();
    logHttpRequest({ method: 'POST', originalUrl: '/api/products?token=private' } as any,
      { statusCode: 201, on: (_event: string, callback: () => void) => { finish = callback; } } as any, next);
    finish();
    expect(next).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^POST \/api\/products 201 \d+ms$/));
  });

  it('prints unexpected error stacks while keeping them out of HTTP responses', () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const reply = jest.fn();
    const adapter = { isHeadersSent: () => false, reply, end: jest.fn() };
    const response = {};
    const host = { switchToHttp: () => ({ getRequest: () => ({ method: 'GET', originalUrl: '/api/audit-logs' }) }),
      getArgByIndex: () => response } as unknown as ArgumentsHost;
    const filter = new ConsoleExceptionFilter({ httpAdapter: adapter } as unknown as HttpAdapterHost);
    filter.catch(new Error('database unavailable'), host);
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining('GET /api/audit-logs 500'), expect.stringContaining('database unavailable'));
    expect(reply).toHaveBeenCalledWith(response, { statusCode: 500, message: 'Internal server error' }, 500);
  });

  it('preserves business validation responses and logs them as warnings', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const reply = jest.fn();
    const adapter = { isHeadersSent: () => false, reply };
    const response = {};
    const host = { switchToHttp: () => ({ getRequest: () => ({ method: 'POST', originalUrl: '/api/products' }) }),
      getArgByIndex: () => response } as unknown as ArgumentsHost;
    new ConsoleExceptionFilter({ httpAdapter: adapter } as unknown as HttpAdapterHost).catch(new BadRequestException('请选择产品阶段'), host);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('请选择产品阶段'));
    expect(reply.mock.calls[0][1].message).toBe('请选择产品阶段');
  });
});
