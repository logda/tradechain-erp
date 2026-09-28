import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SalesOrderService, type CreatedSalesOrderRecord, type SalesOrderLineItem } from '../src/sales-order/sales-order.service';
import { resolveSalesOrderStore } from '../src/sales-order/sales-order.store';
import type { PrismaService } from '../src/storage/prisma.service';

function line(overrides: Partial<SalesOrderLineItem> = {}): SalesOrderLineItem {
  return { lineNo: 1, productId: 1, sku: 'SKU1', productName: '灯带', unit: 'pcs', quantity: 10, salePrice: 99, amount: 12.34, ...overrides };
}
function record(id: number, items: SalesOrderLineItem[], owner = 9001): CreatedSalesOrderRecord {
  return { id, salesNo: `S-LIST-${id}`, title: `S-LIST-${id}-灯带-客户`, status: 'draft',
    currentVersionNo: 1, purchaseAggregateStatus: 'not_started', shipmentAggregateStatus: 'not_started',
    receiptSendStatus: 'pending', afterSalesEndStatus: 'not_started', receiptStatus: 'unpaid', financeStatus: 'pending',
    createdBy: owner, createdAt: '2026-09-28T00:00:00.000Z', sourceMode: 'direct', customerName: '客户',
    salesUserId: owner, salesUserName: '同名员工', versionHistory: [], items };
}

describe.each(['runtime', 'prisma'])('sales list product and amount context in %s storage', (mode) => {
  let dir: string;
  let rows: CreatedSalesOrderRecord[];
  let service: SalesOrderService;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'erp-sales-list-context-'));
    process.env.ERP_DATA_DIR = dir;
    process.env.ERP_STORAGE_MODE = mode;
    rows = [];
    const db = { businessDocument: { findMany: jest.fn(async () => rows.map((payload) => ({
      id: BigInt(payload.id), bizType: 'sales_order', docNo: payload.salesNo, status: payload.status,
      payload, ownerUserId: BigInt(payload.salesUserId), createdBy: BigInt(payload.createdBy),
      createdAt: new Date(payload.createdAt), updatedAt: new Date(payload.createdAt),
    }))) } };
    service = new SalesOrderService(mode === 'prisma' ? db as unknown as PrismaService : undefined);
  });
  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    delete process.env.ERP_STORAGE_MODE;
    rmSync(dir, { recursive: true, force: true });
  });
  function seed(...records: CreatedSalesOrderRecord[]) {
    if (mode === 'prisma') rows.push(...records);
    else records.forEach((item) => resolveSalesOrderStore().upsertSalesOrder(item));
  }

  it('returns unique real products and amount snapshots with per-line quantity/price fallback', async () => {
    const stored = record(1, [line({ productName: ' 灯带 ' }), line({ lineNo: 2, productName: '控制器', amount: 0, quantity: 3, salePrice: 1.234 }),
      line({ lineNo: 3, amount: undefined, quantity: 1, salePrice: 2.5 })]);
    seed(stored);
    const result = await service.list({});
    expect(result.items[0]).toMatchObject({ productNames: ['灯带', '控制器'], amount: 18.54 });
    expect(stored.items?.[0]).toMatchObject({ quantity: 10, salePrice: 99, amount: 12.34 });
    expect(result.items[0]).not.toHaveProperty('confirmedPurchasePrice');
  });

  it('keeps amount unknown for empty items or a line without any amount basis', async () => {
    seed(record(1, []), record(2, [line({ amount: undefined, quantity: undefined, salePrice: undefined })]),
      record(3, [line(), line({ lineNo: 2, amount: undefined, quantity: undefined, salePrice: undefined })]));
    const result = await service.list({ sortBy: 'docNo', sortOrder: 'asc' });
    expect(result.items).toHaveLength(3);
    for (const item of result.items) expect(item).toMatchObject({ amount: undefined });
  });

  it('uses finite quantity and price when a legacy amount is malformed and preserves an explicit zero basis', async () => {
    seed(record(1, [line({ amount: NaN, quantity: 3, salePrice: 1.234 })]),
      record(2, [line({ amount: 0, quantity: undefined, salePrice: undefined })]));
    const result = await service.list({ sortBy: 'docNo', sortOrder: 'asc' });
    expect(result.items[0]).toMatchObject({ amount: 3.7 });
    expect(result.items[1]).toMatchObject({ amount: 0 });
  });

  it.each(['sales', 'boss', 'sales_manager'] as const)('does not expose another same-name employee product or amount to own-scope %s', async (role) => {
    seed(record(1, [line()]), record(2, [line({ productName: '他人产品', amount: 8888 })], 9002));
    const own = await service.list({}, { role, user: '同名员工', userId: 9001, dataScope: 'own_sales' });
    expect(own.total).toBe(1);
    expect(own.items).toEqual([expect.objectContaining({ docNo: 'S-LIST-1', productNames: ['灯带'], amount: 12.34 })]);
    const manager = await service.list({}, { role: 'sales_manager', userId: 9001, dataScope: 'all' });
    expect(manager.total).toBe(2);
    expect(manager.items).toContainEqual(expect.objectContaining({ docNo: 'S-LIST-2', productNames: ['他人产品'], amount: 8888 }));
  });
});
