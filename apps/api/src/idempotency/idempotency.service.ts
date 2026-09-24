import { BadRequestException, ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../storage/prisma.service';
import { resolveStorageMode } from '../storage/storage-mode';

export type IdempotencyRequest = {
  key: string;
  actor: string;
  method: string;
  path: string;
  payload: unknown;
};

@Injectable()
export class IdempotencyService {
  constructor(@Optional() @Inject(PrismaService) private readonly prisma?: PrismaService) {}
  private static readonly inFlight = new Map<string, {
    fingerprint: string;
    promise: Promise<unknown>;
  }>();

  async execute<T>(request: IdempotencyRequest, task: () => Promise<T>): Promise<T> {
    const identity = digest(`${request.actor}\n${request.key}`);
    const fingerprint = digest(JSON.stringify({
      method: request.method,
      path: request.path,
      payload: request.payload,
    }));
    const pending = IdempotencyService.inFlight.get(identity);
    if (pending) {
      if (pending.fingerprint !== fingerprint) {
        throw new BadRequestException('同一请求标识不能用于不同操作');
      }
      return pending.promise as Promise<T>;
    }

    const scope = resolveScope(request);
    const run = resolveStorageMode() === 'prisma'
      ? this.executePrisma(identity, fingerprint, scope, task)
      : this.executeRuntime(identity, fingerprint, scope, task);
    IdempotencyService.inFlight.set(identity, { fingerprint, promise: run });
    try {
      return await run;
    } finally {
      IdempotencyService.inFlight.delete(identity);
    }
  }

  private async executeRuntime<T>(
    identity: string,
    fingerprint: string,
    scope: string,
    task: () => Promise<T>,
  ): Promise<T> {
    const dataDir = process.env.ERP_DATA_DIR?.trim() ||
      join(process.cwd(), '..', '..', 'work', 'erp-data');
    const filePath = join(dataDir, 'idempotency-runtime.json');
    const records = existsSync(filePath)
      ? JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, {
        fingerprint: string;
        scope?: string;
        status: 'pending' | 'succeeded';
        result?: unknown;
      }>
      : {};
    const prior = records[identity];
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        throw new BadRequestException('同一请求标识不能用于不同操作');
      }
      if (prior.status === 'pending') {
        throw new ConflictException('该操作仍在处理中，请核对单据状态');
      }
      return prior.result as T;
    }

    const persist = (record?: { fingerprint: string; scope?: string; status: 'pending' | 'succeeded'; result?: unknown }) => {
      mkdirSync(dataDir, { recursive: true });
      const latest = existsSync(filePath)
        ? JSON.parse(readFileSync(filePath, 'utf8')) as typeof records
        : {};
      if (record) latest[identity] = record;
      else delete latest[identity];
      const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
      writeFileSync(temporaryPath, `${JSON.stringify(latest)}\n`, 'utf8');
      renameSync(temporaryPath, filePath);
    };
    if (Object.values(records).some((record) => record.status === 'pending' && record.scope === scope)) {
      throw new ConflictException('该单据有操作正在处理中，请稍后重试');
    }
    persist({ fingerprint, scope, status: 'pending' });
    let result: T;
    try {
      result = await task();
    } catch (error) {
      persist();
      throw error;
    }
    persist({ fingerprint, status: 'succeeded', result });
    return result;
  }

  private async executePrisma<T>(
    identity: string,
    fingerprint: string,
    scope: string,
    task: () => Promise<T>,
  ): Promise<T> {
    if (!this.prisma) throw new Error('Prisma storage is not configured');
    const delegate = this.prisma.idempotencyRecord;
    const replay = async () => {
      const prior = await delegate.findUnique({ where: { id: identity } });
      if (!prior) return null;
      if (prior.fingerprint !== fingerprint) {
        throw new BadRequestException('同一请求标识不能用于不同操作');
      }
      if (prior.status !== 'succeeded') {
        throw new ConflictException('该操作仍在处理中，请核对单据状态');
      }
      return { found: true as const, value: JSON.parse(prior.result ?? 'null') as T };
    };
    const prior = await replay();
    if (prior) return prior.value;

    try {
      await delegate.create({ data: { id: identity, scope, fingerprint, status: 'pending' } });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const concurrent = await replay();
      if (concurrent) return concurrent.value;
      throw new ConflictException('该单据有操作正在处理中，请稍后重试');
    }

    let result: T;
    try {
      result = await task();
    } catch (error) {
      await delegate.delete({ where: { id: identity } });
      throw error;
    }
    await delegate.update({
      where: { id: identity },
      data: { scope: null, status: 'succeeded', result: JSON.stringify(result ?? null) },
    });
    return result;
  }
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function resolveScope(request: IdempotencyRequest) {
  const parts = request.path.split('/').filter(Boolean);
  const entityIndex = parts.findIndex((part) => /^\d+$/.test(part));
  const resource = entityIndex < 0 ? request.path : `/${parts.slice(0, entityIndex + 1).join('/')}`;
  const createCollections = new Set([
    '/api/quotes', '/api/sales-orders', '/api/purchase-orders',
    '/api/quote-inquiries', '/api/samples', '/api/shipment-batches',
    '/api/after-sales', '/api/stock-in', '/api/stock-out',
    '/api/products', '/api/counterparties', '/api/admin/users',
  ]);
  return digest(entityIndex < 0 && request.method === 'POST' && createCollections.has(resource)
    ? `${request.actor}\n${resource}`
    : resource);
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null &&
    'code' in error && error.code === 'P2002';
}
