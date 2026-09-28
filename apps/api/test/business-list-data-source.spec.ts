import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { QuoteService } from '../src/quote/quote.service';
import { InquiryService } from '../src/inquiry/inquiry.service';
import { SampleOrderService } from '../src/sample-order/sample-order.service';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import { AfterSalesService } from '../src/after-sales/after-sales.service';
import { ReportService } from '../src/report/report.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('business list data sources', () => {
  let dataDir: string;
  const originalMode = process.env.ERP_STORAGE_MODE;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-list-source-'));
    process.env.ERP_DATA_DIR = dataDir;
    process.env.ERP_STORAGE_MODE = 'runtime';
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    rmSync(dataDir, { recursive: true, force: true });
  });

  function services(prisma?: PrismaService) {
    return [new SalesOrderService(prisma), new QuoteService(prisma),
      new InquiryService(prisma), new SampleOrderService(prisma),
      new PurchaseOrderService(prisma), new ShipmentBatchService(prisma),
      new AfterSalesService(prisma)];
  }

  it('empty runtime lists contain no built-in business examples', async () => {
    for (const service of services()) {
      const result = await service.list({});
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    }
  });

  it('keeps persisted sales records and agrees with the all-time summary', async () => {
    const service = new SalesOrderService();
    const created = await service.create({ customerName: '真实客户', title: '真实订单',
      salesUserId: 2001, createdBy: 2001 });
    const list = await service.list({});
    const summary = await new ReportService().getSalesSummary();
    expect(list.total).toBe(1);
    expect(summary.totals.salesOrderCount).toBe(list.total);
    expect(list.items[0].docNo).toBe(created.salesNo);
    expect((await service.getDetail(created.id)).id).toBe(created.id);
  });

  it('Prisma lists use database results without pulling runtime records', async () => {
    await new SalesOrderService().create({ customerName: 'Runtime only', title: 'runtime',
      salesUserId: 2001, createdBy: 2001 });
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prisma = { businessDocument: { findMany: jest.fn().mockResolvedValue([]) } } as unknown as PrismaService;
    for (const service of services(prisma)) {
      expect((await service.list({})).total).toBe(0);
    }
    expect((await new ReportService(prisma).getSalesSummary()).totals.salesOrderCount).toBe(0);
  });
});
