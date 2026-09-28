import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { ReportService } from '../src/report/report.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('sales summary account scope', () => {
  let dir: string;
  const originalMode = process.env.ERP_STORAGE_MODE;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'erp-summary-scope-'));
    process.env.ERP_DATA_DIR = dir;
    process.env.ERP_STORAGE_MODE = 'runtime';
  });
  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    rmSync(dir, { recursive: true, force: true });
  });

  it('runtime own, team and all summaries match their unfiltered lists', async () => {
    const sales = new SalesOrderService();
    await sales.create({ customerName: 'A', title: 'A', salesUserId: 2001, createdBy: 2001 });
    await sales.create({ customerName: 'B', title: 'B', salesUserId: 2002, createdBy: 2002 });
    for (const session of [
      { role: 'sales' as const, user: 'Zoe', userId: 2001, dataScope: 'own_sales' },
      { role: 'sales_manager' as const, user: 'Mia', userId: 2000, dataScope: 'sales_team' },
      { role: 'boss' as const, user: 'Mia', userId: 2000, dataScope: 'all' },
    ]) {
      const summary = await new ReportService().getSalesSummary(session);
      const list = await sales.list({}, session);
      expect(summary.totals.salesOrderCount).toBe(list.total);
      expect(summary.totals.salesOrderCount).toBe(session.role === 'sales' ? 1 : 2);
    }
  });

  it('Prisma filters by stable ID and restricts after-sales to visible sales orders', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prisma = { businessDocument: { findMany: jest.fn().mockImplementation(({ where }) =>
      Promise.resolve(where.bizType === 'sales_order' ? [
        { id: 51n, ownerUserId: 3011n, payload: { id: 51, salesUserId: 3011, createdBy: 9000, status: 'pending_sales_manager_approval', items: [{ amount: 50 }] } },
        { id: 52n, ownerUserId: 3012n, payload: { id: 52, salesUserId: 3012, createdBy: 9000, status: 'pending_sales_manager_approval', items: [{ amount: 100 }] } },
      ] : [
        { payload: { salesOrderId: 51, status: 'processing' } },
        { payload: { salesOrderId: 52, status: 'processing' } },
      ])) } } as unknown as PrismaService;
    const service = new ReportService(prisma);
    const summary = await service.getSalesSummary(
      { role: 'sales', user: '改名后的销售', userId: 3011, dataScope: 'own_sales' });
    expect(summary.totals).toEqual({ salesOrderCount: 1, submittedAmount: 50, shippedAmount: 0, voidedAmount: 0 });
    expect(summary.afterSalesOverview.openCases).toBe(1);
  });
});
