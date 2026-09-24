import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { IdempotencyService } from '../src/idempotency/idempotency.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('IdempotencyService runtime', () => {
  let dataDir: string;
  const originalMode = process.env.ERP_STORAGE_MODE;
  const originalDataDir = process.env.ERP_DATA_DIR;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-idempotency-'));
    process.env.ERP_STORAGE_MODE = 'runtime';
    process.env.ERP_DATA_DIR = dataDir;
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    if (originalDataDir === undefined) delete process.env.ERP_DATA_DIR;
    else process.env.ERP_DATA_DIR = originalDataDir;
  });

  const request = {
    key: '8ed522ac-1bd8-4438-b1d0-fd363036aa8b',
    actor: 'sales:Leo',
    method: 'POST',
    path: '/api/sales-orders',
    payload: { customerId: 42, amount: 80 },
  };

  it('executes two simultaneous copies once and replays the result after restart', async () => {
    const service = new IdempotencyService();
    let writes = 0;
    const write = async () => {
      writes += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { id: 101, status: 'draft' };
    };

    const results = await Promise.all([
      service.execute(request, write),
      service.execute(request, write),
    ]);

    expect(results).toEqual([
      { id: 101, status: 'draft' },
      { id: 101, status: 'draft' },
    ]);
    expect(writes).toBe(1);
    expect(await new IdempotencyService().execute(request, write)).toEqual({
      id: 101,
      status: 'draft',
    });
    expect(writes).toBe(1);
  });

  it('rejects reusing one key with a changed request', async () => {
    const service = new IdempotencyService();
    await service.execute(request, async () => ({ id: 101 }));

    await expect(service.execute({
      ...request,
      payload: { customerId: 42, amount: 81 },
    }, async () => ({ id: 102 }))).rejects.toThrow(BadRequestException);
  });

  it('allows retry after a failed write without recording a success', async () => {
    const service = new IdempotencyService();
    await expect(service.execute(request, async () => {
      throw new Error('temporary failure');
    })).rejects.toThrow('temporary failure');

    expect(await service.execute(request, async () => ({ id: 101 }))).toEqual({ id: 101 });
  });

  it('serializes writes to one document across different actors', async () => {
    const service = new IdempotencyService();
    let release!: () => void;
    const active = service.execute({ ...request, path: '/api/quotes/101/approve' },
      () => new Promise<{ id: number }>((resolve) => { release = () => resolve({ id: 101 }); }));
    await expect(service.execute({
      ...request,
      actor: 'boss:Boss',
      key: '19bd2915-7d19-4892-ad15-57e5f39cd89f',
      path: '/api/quotes/101/reject',
    }, async () => ({ id: 102 }))).rejects.toThrow(ConflictException);
    release();
    await active;
  });
});

describe('IdempotencyService Prisma', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;
  const originalDataDir = process.env.ERP_DATA_DIR;
  let dataDir: string;
  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-idempotency-prisma-'));
    process.env.ERP_DATA_DIR = dataDir;
  });
  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    if (originalDataDir === undefined) delete process.env.ERP_DATA_DIR;
    else process.env.ERP_DATA_DIR = originalDataDir;
  });

  it('replays a completed database-backed create without a second business write', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const rows = new Map<string, {
      id: string;
      fingerprint: string;
      status: string;
      result: unknown;
    }>();
    const prisma = {
      idempotencyRecord: {
        findUnique: async ({ where: { id } }: { where: { id: string } }) => rows.get(id) ?? null,
        create: async ({ data }: { data: { id: string; fingerprint: string; status: string; result: unknown } }) => {
          if (rows.has(data.id)) throw Object.assign(new Error('unique'), { code: 'P2002' });
          rows.set(data.id, data);
          return data;
        },
        update: async ({ where: { id }, data }: { where: { id: string }; data: { status: string; result: unknown } }) => {
          const row = rows.get(id)!;
          rows.set(id, { ...row, ...data });
          return rows.get(id);
        },
        delete: async ({ where: { id } }: { where: { id: string } }) => {
          rows.delete(id);
        },
      },
    } as unknown as PrismaService;
    const request = {
      key: '27742a7e-024b-4137-950a-88609881166c',
      actor: 'sales:Leo',
      method: 'POST',
      path: '/api/quotes',
      payload: { customerId: 9 },
    };
    let writes = 0;
    const write = async () => ({ id: ++writes, status: 'draft' });

    expect(await new IdempotencyService(prisma).execute(request, write)).toEqual({
      id: 1, status: 'draft',
    });
    expect(await new IdempotencyService(prisma).execute(request, write)).toEqual({
      id: 1, status: 'draft',
    });
    expect(writes).toBe(1);
    expect(rows.size).toBe(1);
    expect([...rows.values()][0].status).toBe('succeeded');
  });
});
