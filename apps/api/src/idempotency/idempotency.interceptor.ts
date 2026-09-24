import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, Observable } from 'rxjs';
import { IdempotencyService } from './idempotency.service';

type MutationRequest = {
  method: string;
  originalUrl: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(IdempotencyService) private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<MutationRequest>();
    const method = request.method.toUpperCase();
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return next.handle();

    const key = request.headers['idempotency-key'];
    if (!key) return next.handle();
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(key)) {
      throw new BadRequestException('请求标识格式无效');
    }
    const role = request.headers['x-erp-role'];
    const user = request.headers['x-erp-user'];
    if (typeof role !== 'string' || typeof user !== 'string') return next.handle();

    return from(this.idempotency.execute({
      key,
      actor: `${role}:${user}`,
      method,
      path: request.originalUrl.split('?')[0],
      payload: request.body ?? null,
    }, () => lastValueFrom(next.handle())));
  }
}
