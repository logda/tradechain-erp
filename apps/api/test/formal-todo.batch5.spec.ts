import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FormalTodoService } from '../src/todo/formal-todo.service';
import { FormalTodoController } from '../src/todo/formal-todo.controller';
import { QuoteService } from '../src/quote/quote.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { resolveSalesOrderStore } from '../src/sales-order/sales-order.store';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { resolvePurchaseOrderStore } from '../src/purchase-order/purchase-order.store';
import { UserManagementService } from '../src/user-management/user-management.service';
import { UserManagementRuntimeStore } from '../src/user-management/user-management.store';
import type { PrismaService } from '../src/storage/prisma.service';

function list(items: any[]) {
  return { list: jest.fn().mockResolvedValue({ items, total: items.length }) };
}

function createService(sales = list([]), purchase = list([]), quote = list([]), afterSales = list([])) {
  return new FormalTodoService(quote as never, sales as never, purchase as never,
    list([]) as never, afterSales as never);
}

describe('formal todos batch 5', () => {
  let dataDir: string;
  const originalMode = process.env.ERP_STORAGE_MODE;
  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-todo-batch5-'));
    process.env.ERP_DATA_DIR = dataDir;
    process.env.ERP_STORAGE_MODE = 'runtime';
  });
  afterEach(() => {
    jest.useRealTimers();
    delete process.env.ERP_DATA_DIR;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    rmSync(dataDir, { recursive: true, force: true });
  });

  function salesRecords() {
    return Array.from({ length: 103 }, (_, index) => ({
      id: index + 1, salesNo: `S-${index}`, title: `销售 ${index}`,
      status: index < 100 ? 'draft' : 'pending_sales_manager_approval',
      createdAt: new Date(Date.UTC(2026, 8, 28, 0, 0, -index)).toISOString(),
      customerName: '客户', salesUserId: index === 102 ? 58 : 57, createdBy: index === 102 ? 58 : 57,
      currentVersionNo: 1, sourceMode: 'direct', items: [], versionHistory: [],
      shipmentAggregateStatus: 'not_started', afterSalesEndStatus: 'not_started',
    }));
  }

  function purchaseRecords() {
    return Array.from({ length: 103 }, (_, index) => ({
      id: index + 201, purchaseNo: `P-${index}`, title: `采购 ${index}`,
      status: index < 100 ? 'draft' : 'purchasing',
      createdAt: new Date(Date.UTC(2026, 8, 28, 0, 0, -index)).toISOString(),
      factoryEstimatedDeliveryDate: '2026-09-20', ownerName: '旧采购名',
      ownerId: index === 102 ? 58 : 57, createdBy: 57, supplierName: '工厂',
      salesOrderNo: 'S-SOURCE', currentVersionNo: 1, items: [], versionHistory: [],
    }));
  }

  it('retains old runtime approval and overdue tasks beyond 100 documents without widening ownership', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T00:00:00.000Z'));
    salesRecords().forEach(record => resolveSalesOrderStore().upsertSalesOrder(record as any));
    purchaseRecords().forEach(record => resolvePurchaseOrderStore().upsertPurchaseOrder(record as any));
    const service = new FormalTodoService(new QuoteService(), new SalesOrderService(),
      new PurchaseOrderService(), list([]) as never, list([]) as never);
    const sales = await service.listFormalTodos({ role: 'sales', user: '改名销售', userId: 57,
      dataScope: 'own_sales', modules: ['sales'] });
    expect(sales.items.map(item => item.docNo)).toEqual(['S-100', 'S-101']);
    const purchase = await service.listFormalTodos({ role: 'purchase', user: '改名采购', userId: 57,
      dataScope: 'own_purchase', modules: ['purchase'] });
    expect(purchase.items.map(item => item.docNo)).toEqual(['P-100', 'P-101']);
    expect((await service.listFormalTodos({ role: 'sales_manager', userId: 57,
      dataScope: 'own_sales', modules: ['sales'] })).items.map(item => item.docNo)).toEqual(['S-100', 'S-101']);
    expect(await service.countFormalTodos({ role: 'sales', userId: 57, dataScope: 'own_sales', modules: ['sales'] })).toEqual({ count: 2 });
    expect(await service.countFormalTodos({ role: 'purchase', userId: 57, dataScope: 'own_purchase', modules: ['purchase'] })).toEqual({ count: 2 });
  });

  it('uses paginated Prisma lists to retain old tasks and never reads runtime records in Prisma mode', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T00:00:00.000Z'));
    resolveSalesOrderStore().upsertSalesOrder({ ...salesRecords()[100], id: 999, salesNo: 'RUNTIME-ONLY' } as any);
    const records = [...salesRecords().map(item => ({ id: BigInt(item.id), bizType: 'sales_order',
      docNo: item.salesNo, status: item.status, payload: item, createdAt: new Date(item.createdAt) })),
      ...purchaseRecords().map(item => ({ id: BigInt(item.id), bizType: 'purchase_order',
        docNo: item.purchaseNo, status: item.status, payload: item, createdAt: new Date(item.createdAt) }))];
    const prisma = { businessDocument: {
      findMany: jest.fn().mockImplementation(async ({ where }: any) => records.filter(record =>
        record.bizType === where.bizType && (!where.status || record.status === where.status))),
      findUnique: jest.fn().mockImplementation(async ({ where }: any) => records.find(record => record.id === where.id)),
    } } as unknown as PrismaService;
    process.env.ERP_STORAGE_MODE = 'prisma';
    const service = new FormalTodoService(new QuoteService(prisma), new SalesOrderService(prisma),
      new PurchaseOrderService(prisma), list([]) as never, list([]) as never);
    const result = await service.listFormalTodos({ role: 'boss', dataScope: 'all' });
    expect(result.items.map(item => item.docNo)).toEqual(['S-100', 'P-100', 'S-101', 'P-101', 'S-102', 'P-102']);
    expect(result.total).toBe(6);
    expect(await service.countFormalTodos({ role: 'boss', dataScope: 'all' })).toEqual({ count: 6 });
  });

  it('does not return a false zero when a later source page fails', async () => {
    const sales = { list: jest.fn().mockImplementation(async ({ page }: any) => {
      if (page > 1) throw new Error('读取第二页失败');
      return { items: Array.from({ length: 100 }, (_, index) => ({ docNo: `S-${index}`, status: 'draft' })), total: 101 };
    }) };
    await expect(createService(sales).listFormalTodos()).rejects.toThrow('读取第二页失败');
    await expect(createService(sales).countFormalTodos()).rejects.toThrow('读取第二页失败');
  });

  it('counts the same authorized tasks without loading document details or handler names', async () => {
    const sales = { ...list([
      { docNo: 'S-OWN', title: '我的订单', status: 'pending_sales_manager_approval', ownerId: 57, createdById: 57, detailHref: '/sales-orders/1' },
      { docNo: 'S-OTHER', title: '其他订单', status: 'pending_sales_manager_approval', ownerId: 58, createdById: 58, detailHref: '/sales-orders/2' },
    ]), getDetail: jest.fn().mockResolvedValue({ items: [] }) };
    const quote = { ...list([{ docNo: 'Q-OWN', title: '报价', status: 'pending_customer_feedback', bossConfirmed: true, ownerId: 57, createdById: 57, createdBy: '销售', detailHref: '/quotes/3' }]), getDetail: jest.fn().mockResolvedValue({ items: [] }) };
    const service = createService(sales, list([]), quote);
    for (const query of [
      { role: 'sales' as const, userId: 57, dataScope: 'own_sales' as const, modules: ['sales'], actions: [] },
      { role: 'sales_manager' as const, dataScope: 'sales_team' as const, modules: ['sales'] },
      { role: 'boss' as const, dataScope: 'all' as const },
    ]) {
      const total = (await service.listFormalTodos(query)).total;
      sales.getDetail.mockClear();
      quote.getDetail.mockClear();
      expect(await service.countFormalTodos(query)).toEqual({ count: total });
      expect(sales.getDetail).not.toHaveBeenCalled();
      expect(quote.getDetail).not.toHaveBeenCalled();
    }
  });

  it('keeps the required assignment check without extra display details or Prisma handler lookups', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prisma = { user: { findUnique: jest.fn() } } as unknown as PrismaService;
    const purchase = { ...list([{ docNo: 'P-OWN', title: '采购', status: 'pending_purchase_claim',
      ownerName: '采购员', ownerId: 57, detailHref: '/purchase-orders/1' }]), getDetail: jest.fn() };
    const service = new FormalTodoService(list([]) as never, list([]) as never, purchase as never,
      list([]) as never, list([]) as never, undefined, undefined, prisma);
    expect(await service.countFormalTodos({ role: 'purchase', userId: 57, dataScope: 'own_purchase', modules: ['purchase'] })).toEqual({ count: 1 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(purchase.getDetail).toHaveBeenCalledTimes(1);
    expect(purchase.getDetail).toHaveBeenCalledWith(1);
  });

  it('continues past the first 100 records for each of the seven sources', async () => {
    const paged = (old: any) => ({ list: jest.fn().mockImplementation(async ({ page }: any) => ({
      items: page === 1 ? Array.from({ length: 100 }, (_, index) => ({
        docNo: `NEW-${index}`, inquiryNo: `NEW-${index}`, status: 'draft', bossConfirmed: true,
        hasException: false, receiptSendStatus: 'sent', createdBy: '销售', lifecycleStatus: 'open',
      })) : [old], total: 101,
    })) });
    const service = new FormalTodoService(
      paged({ docNo: 'OLD-Q', title: '报价', bossConfirmed: false, createdBy: '销售', detailHref: '/quotes/1' }) as never,
      paged({ docNo: 'OLD-S', title: '销售', status: 'pending_sales_manager_approval', createdBy: '销售', detailHref: '/sales-orders/1' }) as never,
      paged({ docNo: 'OLD-P', title: '采购', status: 'pending_purchase_manager_approval', detailHref: '/purchase-orders/1' }) as never,
      paged({ docNo: 'OLD-SH', title: '发货', hasException: true, receiptSendStatus: 'sent', detailHref: '/shipment-batches/1' }) as never,
      paged({ docNo: 'OLD-AS', title: '售后', status: 'pending_approval', detailHref: '/after-sales/1' }) as never,
      paged({ inquiryNo: 'OLD-I', quoteOrderNo: 'Q', customerName: '客户', status: 'pending_boss_review', createdBy: '销售', detailHref: '/inquiries/1' }) as never,
      paged({ docNo: 'OLD-SP', title: '样品', status: 'pending_approval', ownerName: '销售', detailHref: '/samples/1' }) as never,
    );
    expect((await service.listFormalTodos({ role: 'boss' })).items.map(item => item.docNo))
      .toEqual(['OLD-Q', 'OLD-I', 'OLD-SP', 'OLD-S', 'OLD-P', 'OLD-SH', 'OLD-AS']);
  });

  it('distinguishes a sales follow-up from a manager action and honors explicit action restrictions', async () => {
    const service = createService(list([{ docNo: 'S-1', title: '客户订单', status: 'pending_sales_manager_approval',
      ownerName: '业务主管', ownerId: 57, createdById: 57, createdBy: '业务主管', detailHref: '/sales-orders/1' }]));
    const seller: any = await service.listFormalTodos({ role: 'sales', user: '业务主管', userId: 57 });
    expect(seller.items[0]).toMatchObject({ relation: 'following', nextAction: '审批销售单', handlerLabel: '销售主管' });
    expect(seller).toMatchObject({ total: 1, actionTotal: 0, followingTotal: 1 });
    const manager: any = await service.listFormalTodos({ role: 'sales_manager', user: '采购员', actions: ['sales.order.write'] } as any);
    expect(manager.items[0].relation).toBe('action');
    expect(manager).toMatchObject({ total: 1, actionTotal: 1, followingTotal: 0 });
    const restricted: any = await service.listFormalTodos({ role: 'sales_manager', actions: [] } as any);
    expect(restricted.items[0].relation).toBe('following');
    expect(restricted.total).toBe(1);
  });

  it('classifies all existing nodes using their controller roles and actions', async () => {
    const quote = list([
      { docNo: 'Q-APPROVE', title: '报价', bossConfirmed: false, createdBy: '销售', detailHref: '/quotes/1' },
      { docNo: 'Q-FOLLOW', title: '报价', status: 'pending_customer_feedback', bossConfirmed: true, createdBy: '销售', detailHref: '/quotes/2' },
    ]);
    const sales = { ...list([{ docNo: 'S-REJECT', title: '销售', status: 'rejected', ownerName: '销售', createdBy: '销售', detailHref: '/sales-orders/3' }]),
      listPendingPurchaseAssignments: jest.fn().mockResolvedValue([{ salesNo: 'S-ASSIGN', title: '销售' }]) };
    const purchase = list([
      { docNo: 'P-APPROVE', title: '采购', status: 'pending_purchase_manager_approval', detailHref: '/purchase-orders/4' },
      { docNo: 'P-CLAIM', title: '采购', status: 'pending_purchase_claim', ownerName: '采购', detailHref: '/purchase-orders/5' },
    ]);
    const inquiry = list([
      { inquiryNo: 'I-WORK', quoteOrderNo: 'Q1', status: 'pending_inquiry', customerName: '客户', createdBy: '销售', detailHref: '/inquiries/6' },
      { inquiryNo: 'I-BOSS', quoteOrderNo: 'Q1', status: 'pending_boss_review', customerName: '客户', createdBy: '销售', detailHref: '/inquiries/7' },
    ]);
    const sample = list(['pending_approval', 'pending_sampling', 'sampling', 'sample_sent'].map((status, index) => ({
      docNo: `SP-${index}`, title: '样品', status, ownerName: '销售', detailHref: `/samples/${index + 8}`,
    })));
    const shipment = list([{ docNo: 'SH-1', title: '发货', hasException: true, receiptSendStatus: 'pending', ownerName: '采购', detailHref: '/shipment-batches/12' }]);
    const afterSales = list([
      { docNo: 'AS-1', title: '售后', status: 'pending_approval', ownerName: '采购', detailHref: '/after-sales/13' },
      { docNo: 'AS-2', title: '售后', status: 'finance_reviewing', financeReviewStatus: 'pending', ownerName: '采购', detailHref: '/after-sales/14' },
    ]);
    const service = new FormalTodoService(quote as never, sales as never, purchase as never,
      shipment as never, afterSales as never, inquiry as never, sample as never);
    const boss: any = await service.listFormalTodos({ role: 'boss', actions: ['boss.confirm'] } as any);
    expect(boss.items.filter((item: any) => item.relation === 'action').map((item: any) => item.docNo))
      .toEqual(['Q-APPROVE', 'Q-FOLLOW', 'I-BOSS']);
    expect(boss.items.every((item: any) => item.nextAction && item.handlerLabel)).toBe(true);
    const purchaser: any = await service.listFormalTodos({ role: 'purchase', user: '采购', actions: ['sales.inquiry.submit', 'purchase.sample.execute', 'purchase.order.submit', 'shipment.update'] } as any);
    expect(purchaser.items.filter((item: any) => item.relation === 'action').map((item: any) => item.docNo))
      .toEqual(['I-WORK', 'SP-1', 'SP-2', 'P-CLAIM', 'SH-1']);
    const noPurchaseModule: any = await service.listFormalTodos({ role: 'boss', modules: ['sales'], actions: ['boss.confirm'] } as any);
    expect(noPurchaseModule.items.find((item: any) => item.docNo === 'I-BOSS')?.relation).toBe('following');
  });

  it('shows current real handler names by stable owner ID after a rename', async () => {
    const users = new UserManagementService();
    const owner = await users.create({ username: 'owner', realName: '旧采购名', password: 'secret', roleCode: 'purchase', createdBy: 'admin' });
    const store = (users as any).store as UserManagementRuntimeStore;
    store.saveUsers(store.listUsers().map(user => user.id === owner.id ? { ...user, realName: '新采购名' } : user));
    const service = createService(list([]), list([{ docNo: 'P-1', title: '采购', status: 'pending_purchase_claim',
      ownerName: '旧采购名', ownerId: owner.id, detailHref: '/purchase-orders/1' }]));
    const result: any = await service.listFormalTodos({ role: 'purchase', userId: owner.id, user: '新采购名' });
    expect(result.items[0]).toMatchObject({ relation: 'action', handlerLabel: '新采购名' });
  });

  it('returns Shanghai calendar days, explicit overdue labels and the successful read time without changing creation order', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-27T16:30:00.000Z'));
    const purchase = list([
      { docNo: 'P-FUTURE', title: '未来', status: 'purchasing', ownerName: '采购', factoryEstimatedDeliveryDate: '2026-09-30', detailHref: '/purchase-orders/1', createdAt: '2026-09-27T12:00:00.000Z' },
      { docNo: 'P-OVERDUE', title: '逾期', status: 'partial_shipped', ownerName: '采购', factoryEstimatedDeliveryDate: '2026-09-23', detailHref: '/purchase-orders/2', createdAt: '2026-09-25T12:00:00.000Z' },
      { docNo: 'P-TODAY', title: '当天', status: 'purchasing', ownerName: '采购', factoryEstimatedDeliveryDate: '2026-09-28', detailHref: '/purchase-orders/3', createdAt: '2026-09-26T12:00:00.000Z' },
      { docNo: 'P-LATER', title: '远期', status: 'purchasing', ownerName: '采购', factoryEstimatedDeliveryDate: '2026-10-02', detailHref: '/purchase-orders/4' },
    ]);
    const result: any = await createService(list([]), purchase).listFormalTodos({ role: 'purchase', user: '采购' });
    expect(result.items.map((item: any) => item.docNo)).toEqual(['P-FUTURE', 'P-TODAY', 'P-OVERDUE']);
    expect(result.items[0]).toMatchObject({ dueDate: '2026-09-30', dueInDays: 2, statusLabel: '还有 2 天' });
    expect(result.items[1]).toMatchObject({ dueInDays: 0, statusLabel: '今天到期' });
    expect(result.items[2]).toMatchObject({ dueInDays: -5, statusLabel: '已逾期 5 天' });
    expect(result.generatedAt).toBe('2026-09-27T16:30:00.000Z');
  });

  it('ignores invalid calendar dates rather than returning NaN or false overdue reminders', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-27T16:30:00.000Z'));
    const purchase = list(['2026-02-30', '2026-00-10', '2026-09-31', 'not-a-date'].map((date, index) => ({
      docNo: `P-INVALID-${index}`, title: '采购', status: 'purchasing', ownerName: '采购',
      factoryEstimatedDeliveryDate: date, detailHref: `/purchase-orders/${index + 1}`,
    })));
    expect((await createService(list([]), purchase).listFormalTodos({ role: 'purchase', user: '采购' })).items).toEqual([]);
  });

  it('resolves the current handler name from Prisma by ID without consulting a same-name runtime employee', async () => {
    const runtimeUsers = new UserManagementService();
    const user = await runtimeUsers.create({ username: 'runtime-person', realName: '本地旧名', password: 'secret', roleCode: 'purchase', createdBy: 'admin' });
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: BigInt(user.id), realName: '数据库新名' }) } } as unknown as PrismaService;
    process.env.ERP_STORAGE_MODE = 'prisma';
    const purchase = list([{ docNo: 'P-PRISMA', title: '采购', status: 'pending_purchase_claim', ownerName: '旧采购名', ownerId: user.id, detailHref: '/purchase-orders/1' }]);
    const service = new FormalTodoService(list([]) as never, list([]) as never, purchase as never,
      list([]) as never, list([]) as never, undefined, undefined, prisma);
    expect((await service.listFormalTodos({ role: 'purchase', userId: user.id })).items[0])
      .toMatchObject({ handlerLabel: '数据库新名', relation: 'action' });
  });

  it('keeps the database source handler label when a Prisma dependency is unavailable instead of reading runtime users', async () => {
    const user = await new UserManagementService().create({ username: 'runtime-person', realName: '本地姓名', password: 'secret', roleCode: 'purchase', createdBy: 'admin' });
    process.env.ERP_STORAGE_MODE = 'prisma';
    const purchase = list([{ docNo: 'P-PRISMA', title: '采购', status: 'pending_purchase_claim', ownerName: '数据库来源姓名', ownerId: user.id, detailHref: '/purchase-orders/1' }]);
    expect((await createService(list([]), purchase).listFormalTodos({ role: 'purchase', userId: user.id })).items[0])
      .toMatchObject({ handlerLabel: '数据库来源姓名' });
  });

  it('deduplicates visible tasks and closed sources even when a source is processed by several nodes', async () => {
    const open = { docNo: 'S-1', title: '销售', status: 'pending_sales_manager_approval', ownerName: '销售', detailHref: '/sales-orders/1' };
    const closed = { docNo: 'P-CLOSED', title: '采购', status: 'voided', lifecycleStatus: 'voided', ownerName: '采购', detailHref: '/purchase-orders/2' };
    const service = createService(list([open, open]), list([closed, closed]), list([]), list([
      { docNo: 'AS-CLOSED', title: '售后', status: 'voided', lifecycleStatus: 'voided', ownerName: '采购', detailHref: '/after-sales/3' },
    ]));
    const result: any = await service.listFormalTodos({ role: 'boss' });
    expect(result.total).toBe(1);
    expect(result.actionTotal + result.followingTotal).toBe(1);
    expect(result.closedTotal).toBe(2);
  });

  it('reads verified action headers in the formal todo controller, including explicitly empty actions', async () => {
    const service = { listFormalTodos: jest.fn().mockResolvedValue({ items: [] }) };
    const controller = new FormalTodoController(service as any);
    await controller.listFormalTodos({ headers: { 'x-erp-role': 'sales_manager', 'x-erp-actions': 'sales.order.write,boss.confirm' } });
    expect(service.listFormalTodos).toHaveBeenLastCalledWith(expect.objectContaining({ actions: ['sales.order.write', 'boss.confirm'] }));
    await controller.listFormalTodos({ headers: { 'x-erp-role': 'sales_manager', 'x-erp-actions': '' } });
    expect(service.listFormalTodos).toHaveBeenLastCalledWith(expect.objectContaining({ actions: [] }));
  });
});
