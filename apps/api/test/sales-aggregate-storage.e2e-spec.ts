import { PrismaService } from '../src/storage/prisma.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Supply an isolated, migrated database explicitly; ordinary CI has no MySQL dependency.
const describeDatabase = process.env.ERP_TEST_DATABASE_URL ? describe : describe.skip;

describeDatabase('real Prisma sales aggregate audit storage', () => {
  let prisma: PrismaService;
  let id: number | undefined;
  const originalUrl = process.env.DATABASE_URL;
  const originalMode = process.env.ERP_STORAGE_MODE;
  const originalDataDir = process.env.ERP_DATA_DIR;
  let runtimeDir: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.ERP_TEST_DATABASE_URL;
    process.env.ERP_STORAGE_MODE = 'prisma';
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-prisma-audit-'));
    process.env.ERP_DATA_DIR = runtimeDir;
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (id !== undefined) {
      await prisma.operationLog.deleteMany({ where: { bizType: 'sales_order', bizId: BigInt(id) } });
      await prisma.businessDocument.delete({ where: { id: BigInt(id) } });
    }
    await prisma.$disconnect();
    rmSync(runtimeDir, { recursive: true, force: true });
    if (originalDataDir === undefined) delete process.env.ERP_DATA_DIR;
    else process.env.ERP_DATA_DIR = originalDataDir;
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
  });

  it('persists the actual fulfillment update and its full operation name together', async () => {
    const sales = new SalesOrderService(prisma);
    const order = await sales.create({ customerName: '独立落库验证客户', title: '同步日志验证', salesUserId: 3, createdBy: 3 });
    id = order.id;
    await sales.syncOperationalAggregates({ salesOrderId: id, purchaseAggregateStatus: 'purchasing', source: 'purchase_order', operatorId: 1 });
    expect(await sales.getDetail(id)).toMatchObject({ purchaseAggregateStatus: 'purchasing' });
    const audit = await sales.listAuditLogs(id);
    expect(audit.items).toEqual(expect.arrayContaining([expect.objectContaining({
      operationType: 'sync_sales_order_operational_aggregates', operatorId: 1,
      afterData: expect.objectContaining({ purchaseAggregateStatus: 'purchasing' }),
    })]));
  });
});
