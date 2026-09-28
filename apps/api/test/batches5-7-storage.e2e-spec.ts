import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../src/storage/prisma.service';
import { ReportService } from '../src/report/report.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { QuoteService } from '../src/quote/quote.service';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import { AfterSalesService } from '../src/after-sales/after-sales.service';
import type { FormalSession } from '../src/auth/formal-session';
import { FormalTodoService } from '../src/todo/formal-todo.service';

// This suite only runs against an explicitly supplied, isolated migrated database.
const describeDatabase = process.env.ERP_TEST_DATABASE_URL ? describe : describe.skip;
describeDatabase('v1.2.2 actual Prisma todo and report storage', () => {
  let prisma: PrismaService;
  let ownerId: number;
  let dataDir: string;
  const ids: bigint[] = [];
  const previous = { DATABASE_URL: process.env.DATABASE_URL, ERP_STORAGE_MODE: process.env.ERP_STORAGE_MODE, ERP_DATA_DIR: process.env.ERP_DATA_DIR };
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.ERP_TEST_DATABASE_URL;
    process.env.ERP_STORAGE_MODE = 'prisma';
    dataDir = mkdtempSync(join(tmpdir(), 'erp-v122-todo-report-'));
    process.env.ERP_DATA_DIR = dataDir;
    prisma = new PrismaService(); await prisma.$connect();
    const owner = await prisma.user.create({ data: { username: `b58-test-${Date.now()}`, realName: '批次验证员工',
      passwordHash: 'unused-in-isolated-service-test', roleCode: 'sales', status: 'active', createdBy: 'test' } });
    ownerId = Number(owner.id);
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.operationLog.deleteMany({ where: { bizType: 'sales_order', bizId: { in: ids } } });
      await prisma.businessDocument.deleteMany({ where: { id: { in: ids } } });
      if (ownerId) await prisma.user.delete({ where: { id: BigInt(ownerId) } });
      await prisma.$disconnect();
    }
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  it('retains an old approval task after more than 100 newer actual documents', async () => {
    const sales = new SalesOrderService(prisma);
    const owner: FormalSession = { role: 'sales', userId: ownerId, user: '批次验证员工', dataScope: 'own_sales', modules: ['sales'], actions: ['sales.order.write'] };
    const old = await sales.create({ customerName: '隔离验证客户', title: '最旧待审批', salesUserId: ownerId, createdBy: ownerId });
    ids.push(BigInt(old.id));
    await sales.submit({ salesOrderId: old.id, currentStatus: 'draft', operatorId: ownerId });
    const record = await prisma.businessDocument.findUniqueOrThrow({ where: { id: BigInt(old.id) } });
    await prisma.businessDocument.update({ where: { id: record.id }, data: { createdAt: new Date('2026-08-31T15:59:59.999Z'),
      payload: { ...record.payload as object, createdAt: '2026-08-31T15:59:59.999Z' } } });
    for (let index = 0; index < 105; index += 1) {
      const newer = await sales.create({ customerName: '隔离验证客户', title: `新草稿${index}`, salesUserId: ownerId, createdBy: ownerId });
      ids.push(BigInt(newer.id));
    }
    const firstPage = await sales.list({ page: 1, pageSize: 100 }, owner);
    expect(firstPage.items.some(item => item.docNo === old.salesNo)).toBe(false);
    const service = new FormalTodoService(new QuoteService(prisma), sales, new PurchaseOrderService(prisma),
      new ShipmentBatchService(prisma), new AfterSalesService(prisma), undefined, undefined, prisma);
    const todos = await service.listFormalTodos(owner);
    expect(todos.items).toEqual(expect.arrayContaining([expect.objectContaining({ docNo: old.salesNo, relation: 'following', handlerLabel: '销售主管' })]));
    expect(todos.total).toBe(todos.actionTotal + todos.followingTotal);
  }, 30000);
  it('uses real document creation dates and real resubmission logs, with unknown costs kept unavailable', async () => {
    const reports = new ReportService(prisma);
    const session: FormalSession = { role: 'boss', userId: ownerId, user: '批次验证员工', dataScope: 'own_sales' };
    const august = await reports.getPeriodSummary(session, '2026-08');
    expect(august.salesOrdersCreated).toBe(1);
    expect(august.sourceDocuments).toEqual(expect.arrayContaining([expect.objectContaining({ id: Number(ids[0]) })]));
    const sales = new SalesOrderService(prisma);
    await sales.reject({ salesOrderId: Number(ids[0]), currentStatus: 'pending_sales_manager_approval', operatorId: 1, rejectionReason: '隔离测试修改内容' });
    await sales.submit({ salesOrderId: Number(ids[0]), currentStatus: 'rejected', operatorId: ownerId });
    const month = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 7);
    const current = await reports.getPeriodSummary(session, month);
    expect(current.reopenedApprovals).toBe(1);
    expect((await reports.getPeriodSummary(session, '2026-08')).reopenedApprovals).toBe(0);
    const gross = await reports.getGrossProfitSummary(session);
    expect(gross).toMatchObject({ totalRevenue: null, totalAfterSalesCost: null, grossProfit: null, grossMargin: null,
      calculationStatus: 'incomplete', unknownCurrencyCount: 1 });
    expect(gross.sourceDocuments).toEqual(expect.arrayContaining([expect.objectContaining({ id: Number(ids[0]), currency: null })]));
  });

});
