import { Catch, HttpException, Inject, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

type HttpRequest = { method: string; originalUrl?: string; url?: string };
type HttpResponse = { statusCode: number; on: (event: string, callback: () => void) => void };
const requestLogger = new Logger('HTTP');

function requestLabel(request: HttpRequest) {
  return `${request.method} ${(request.originalUrl ?? request.url ?? '/').split('?')[0]}`;
}

export function logHttpRequest(request: HttpRequest, response: HttpResponse, next: () => void) {
  const started = Date.now();
  response.on('finish', () => {
    requestLogger.log(`${requestLabel(request)} ${response.statusCode} ${Date.now() - started}ms`);
  });
  next();
}

@Catch()
export class ConsoleExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('HTTPError');

  constructor(@Inject(HttpAdapterHost) adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<HttpRequest>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const message = `${requestLabel(request)} ${status} ${exception instanceof Error ? exception.message : '请求异常'}`;
    if (status >= 500) {
      this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(message);
    }
    super.catch(exception, host);
  }
}
