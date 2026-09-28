import { BadRequestException } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { SalesOrderService, type CreatedSalesOrderRecord } from '../src/sales-order/sales-order.service';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { resolveSalesOrderStore } from '../src/sales-order/sales-order.store';
import { resolvePurchaseOrderStore } from '../src/purchase-order/purchase-order.store';
import { resolveShipmentBatchStore } from '../src/shipment-batch/shipment-batch.store';
import type { CreatedPurchaseOrderRecord } from '../src/purchase-order/purchase-order.service';
import type { CreatedShipmentBatchRecord } from '../src/shipment-batch/shipment-batch.service';
import type { PrismaService } from '../src/storage/prisma.service';

const order: CreatedSalesOrderRecord = {
  id: 104, salesNo: 'S104', status: 'purchasing', currentVersionNo: 1,
  purchaseAggregateStatus: 'purchasing', shipmentAggregateStatus: 'not_started',
  receiptSendStatus: 'pending', afterSalesEndStatus: 'not_started', receiptStatus: 'unpaid',
  financeStatus: 'pending', createdBy: 2001, createdAt: '2026-09-28T02:00:00.000Z',
  sourceMode: 'direct', customerName: 'Test customer', title: 'Test sale', salesUserId: 2001,
  versionHistory: [], items: [],
};

function purchase(id: number, sourceSalesOrderId = 104, status = 'purchasing'): CreatedPurchaseOrderRecord {
  return { id, purchaseNo: `P${id}`, sourceSalesOrderId, supplierId: 1, supplierName: 'Factory',
    ownerName: 'Buyer', currentVersionNo: 1, status, itemCount: 0, createdBy: 2002,
    createdAt: order.createdAt, salesOrderNo: `S${sourceSalesOrderId}`, currentBatchCount: 0,
    versionHistory: [], items: [] };
}
function shipment(salesOrderId = 104, purchaseOrderId = 301): CreatedShipmentBatchRecord {
  return { id: 401, batchNo: 'SH401', status: 'shipped', receiptSendStatus: 'pending',
    shippedQty: 1, accumulatedQty: 1, remainingQty: 0, shippedAt: order.createdAt,
    createdBy: 2002, salesOrderId, purchaseOrderId, purchaseOrderCurrentStatus: 'shipped',
    currentBatchCount: 1, salesOrderLocked: true, supplierName: 'Factory', salesOrderNo: `S${salesOrderId}`,
    purchaseOrderNo: `P${purchaseOrderId}`, title: 'Shipment', createdAt: order.createdAt, hasException: false, items: [] };
}

// The Prisma boundary is an in-memory database; service logic and runtime stores remain real.
function prismaDatabase() {
  const documents = new Map<number, any>();
  const logs: any[] = [];
  let transactions = Promise.resolve<unknown>(undefined);
  const db: any = {
    $queryRaw: async () => [],
    businessDocument: {
      findUnique: async ({ where }: any) => structuredClone(documents.get(Number(where.id)) ?? null),
      findMany: async ({ where }: any = {}) => [...documents.values()].filter(row =>
        !where?.bizType || (typeof where.bizType === 'string' ? row.bizType === where.bizType : where.bizType.in.includes(row.bizType))).map(row => structuredClone(row)),
      updateMany: async ({ where, data }: any) => {
        const existing = documents.get(Number(where.id));
        if (!existing || existing.status !== where.status || !isDeepStrictEqual(existing.payload, where.payload.equals)) return { count: 0 };
        documents.set(Number(where.id), { ...existing, ...structuredClone(data) });
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        const record = { ...documents.get(Number(where.id)), ...structuredClone(data) };
        documents.set(Number(where.id), record);
        return record;
      },
    },
    operationLog: {
      create: async ({ data }: any) => {
        const record = { ...structuredClone(data), id: BigInt(logs.length + 1), createdAt: new Date() };
        logs.push(record); return record;
      },
      findMany: async () => logs,
    },
    $transaction: (operation: (tx: any) => unknown) => {
      const run = transactions.then(async () => {
        const writes = new Map<number, { before: any; after: any }>();
        const writtenLogs: any[] = [];
        const tx = {
          $queryRaw: db.$queryRaw,
          businessDocument: { ...db.businessDocument,
            update: async (args: any) => {
              const id = Number(args.where.id); const before = documents.get(id);
              const result = await db.businessDocument.update(args);
              writes.set(id, { before: writes.get(id)?.before ?? before, after: documents.get(id) });
              return result;
            },
            updateMany: async (args: any) => {
              const id = Number(args.where.id); const before = documents.get(id);
              const result = await db.businessDocument.updateMany(args);
              if (result.count) writes.set(id, { before: writes.get(id)?.before ?? before, after: documents.get(id) });
              return result;
            },
          },
          operationLog: { ...db.operationLog, create: async (args: any) => {
            const log = await db.operationLog.create(args); writtenLogs.push(log); return log;
          } },
        };
        try { return await operation(tx); }
        catch (error) {
          for (const [id, write] of writes) if (documents.get(id) === write.after) documents.set(id, write.before);
          for (const log of writtenLogs) { const index = logs.indexOf(log); if (index >= 0) logs.splice(index, 1); }
          throw error;
        }
      });
      transactions = run.catch(() => undefined);
      return run;
    },
  };
  return { db, documents, logs };
}

describe.each(['runtime', 'prisma'])('sales payment and cancellation in %s storage', (mode) => {
  let runtimeDir: string;
  let service: SalesOrderService;
  let database: ReturnType<typeof prismaDatabase>;
  function seed(bizType: string, record: any) {
    if (mode === 'prisma') {
      database.documents.set(record.id, {
        id: BigInt(record.id), bizType, docNo: record.salesNo ?? record.purchaseNo ?? record.batchNo,
        status: record.status, payload: structuredClone(record), ownerUserId: 2001n,
        counterpartyId: null, createdBy: BigInt(record.createdBy), createdAt: new Date(record.createdAt), updatedAt: new Date(record.createdAt),
      });
    } else if (bizType === 'sales_order') resolveSalesOrderStore().upsertSalesOrder(record);
    else if (bizType === 'purchase_order') resolvePurchaseOrderStore().upsertPurchaseOrder(record);
    else resolveShipmentBatchStore().upsertShipmentBatch(record);
  }
  function stored(bizType: string, id: number) {
    if (mode === 'prisma') return database.documents.get(id)?.payload;
    if (bizType === 'sales_order') return resolveSalesOrderStore().getSalesOrder(id);
    return resolvePurchaseOrderStore().getPurchaseOrder(id);
  }
  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-sales-payment-'));
    process.env.ERP_DATA_DIR = runtimeDir;
    process.env.ERP_STORAGE_MODE = mode;
    database = prismaDatabase();
    service = new SalesOrderService(mode === 'prisma' ? database.db as PrismaService : undefined);
    seed('sales_order', order);
  });
  afterEach(() => {
    delete process.env.ERP_DATA_DIR; delete process.env.ERP_STORAGE_MODE;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('rejects stale concurrent finance review instead of restoring an outdated paid receipt', async () => {
    seed('sales_order', { ...order, receiptStatus: 'deposit_received' });
    const results = await Promise.allSettled([
      service.updateReceiptStatus({ salesOrderId: 104, receiptStatus: 'unpaid', operatorId: 9007 }),
      service.confirmFinance({ salesOrderId: 104, operatorId: 9008 }),
    ]);
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
    const rejected = results[1] as PromiseRejectedResult;
    expect(rejected.reason.message).toMatch(/刷新/);
    expect(stored('sales_order', 104)).toMatchObject({ receiptStatus: 'unpaid', financeStatus: 'pending' });
    expect((await service.listAuditLogs(104)).items).toHaveLength(1);
  });
  it('rejects a stale supervisor rejection after another request approves the order', async () => {
    seed('sales_order', { ...order, status: 'pending_sales_manager_approval' });
    const results = await Promise.allSettled([
      service.reject({ salesOrderId: 104, currentStatus: 'pending_sales_manager_approval', rejectionReason: 'Review price' }),
      service.approve({ salesOrderId: 104, currentStatus: 'pending_sales_manager_approval', purchaseOwnerName: 'Buyer' }),
    ]);
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled']);
    expect(stored('sales_order', 104).status).toBe('purchasing');
    expect((await service.listAuditLogs(104)).items.map(log => log.operationType)).toEqual(['approve_sales_order']);
  });
  it('does not void linked purchases when a concurrent fulfillment update makes the cancellation stale', async () => {
    seed('purchase_order', purchase(301));
    const fulfillment = service.syncOperationalAggregates({ salesOrderId: 104, shipmentAggregateStatus: 'shipped', operatorId: 9008 });
    const cancellation = service.cancel({ salesOrderId: 104, currentStatus: 'purchasing', cancelReason: 'Actual reason' });
    const results = await Promise.allSettled([cancellation, fulfillment]);
    expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled']);
    expect(stored('sales_order', 104)).toMatchObject({ status: 'purchasing', shipmentAggregateStatus: 'shipped' });
    expect(stored('purchase_order', 301).status).toBe('purchasing');
    const purchaseLogs = mode === 'prisma' ? database.logs.filter(log => log.bizType === 'purchase_order') : resolvePurchaseOrderStore().listAuditLogs();
    expect(purchaseLogs).toHaveLength(0);
  });
  it('rejects cancellation before changing any records if a linked purchase changes after the preview read', async () => {
    seed('purchase_order', purchase(301)); seed('purchase_order', purchase(302));
    if (mode === 'runtime') {
      const store = resolvePurchaseOrderStore(); const list = store.listPurchaseOrders.bind(store);
      jest.spyOn(store, 'listPurchaseOrders').mockImplementationOnce(() => {
        const records = list(); queueMicrotask(() => seed('purchase_order', { ...purchase(302), ownerName: 'New owner' })); return records;
      });
    } else {
      const findMany = database.db.businessDocument.findMany;
      jest.spyOn(database.db.businessDocument, 'findMany').mockImplementationOnce(async (args: any) => {
        const records = await findMany(args); seed('purchase_order', { ...purchase(302), ownerName: 'New owner' }); return records;
      });
    }
    await expect(service.cancel({ salesOrderId: 104, currentStatus: 'purchasing', cancelReason: 'Actual reason' })).rejects.toThrow(/刷新/);
    expect(stored('sales_order', 104).status).toBe('purchasing');
    expect(stored('purchase_order', 301).status).toBe('purchasing');
    expect(stored('purchase_order', 302)).toMatchObject({ status: 'purchasing', ownerName: 'New owner' });
    expect((await service.listAuditLogs(104)).items).toHaveLength(0);
  });
  it('keeps a successful receipt registration when fulfillment synchronization races with it', async () => {
    const results = await Promise.allSettled([
      service.updateReceiptStatus({ salesOrderId: 104, receiptStatus: 'deposit_received' }),
      service.syncOperationalAggregates({ salesOrderId: 104, shipmentAggregateStatus: 'shipped', source: 'shipment_batch', operatorId: 9008 }),
    ]);
    if (results[0].status === 'fulfilled') expect(stored('sales_order', 104).receiptStatus).toBe('deposit_received');
    else expect(results[0].reason.message).toMatch(/刷新/);
    expect(results[1].status).toBe('fulfilled');
    expect(stored('sales_order', 104).shipmentAggregateStatus).toBe('shipped');
    expect((await service.listAuditLogs(104)).items).toContainEqual(expect.objectContaining({
      operationType: 'sync_sales_order_operational_aggregates', operatorId: 9008,
      afterData: expect.objectContaining({ syncSource: 'shipment_batch' }),
    }));
  });
  if (mode === 'prisma') {
    it('does not fall back to a runtime order when Prisma fulfillment sync has no saved source', async () => {
      database.documents.delete(104);
      resolveSalesOrderStore().upsertSalesOrder(order);
      await expect(service.syncOperationalAggregates({ salesOrderId: 104, shipmentAggregateStatus: 'shipped', source: 'shipment_batch' })).rejects.toThrow('销售单不存在');
      expect(resolveSalesOrderStore().getSalesOrder(104)).toMatchObject({ shipmentAggregateStatus: 'not_started' });
      expect(resolveSalesOrderStore().listAuditLogs()).toHaveLength(0);
      expect(database.logs).toHaveLength(0);
    });
    it('does not overwrite a newly registered receipt when the fulfillment read finishes late', async () => {
      let releaseRead!: () => void; let markRead!: () => void;
      const blockedRead = new Promise<void>(resolve => { releaseRead = resolve; });
      const readStarted = new Promise<void>(resolve => { markRead = resolve; });
      const findUnique = database.db.businessDocument.findUnique;
      jest.spyOn(database.db.businessDocument, 'findUnique').mockImplementationOnce(async (args: any) => {
        const captured = await findUnique(args);
        markRead(); await blockedRead; return captured;
      });
      const fulfillment = service.syncOperationalAggregates({ salesOrderId: 104,
        shipmentAggregateStatus: 'shipped', operatorId: 9008, source: 'shipment_batch' });
      await readStarted;
      const receipt = service.updateReceiptStatus({ salesOrderId: 104, receiptStatus: 'deposit_received', operatorId: 9007 });
      // Let an unprotected receipt transaction finish while fulfillment holds an old read.
      for (let turn = 0; turn < 25; turn++) await Promise.resolve();
      releaseRead();
      const results = await Promise.allSettled([receipt, fulfillment]);
      if (results[0].status === 'fulfilled') expect(stored('sales_order', 104).receiptStatus).toBe('deposit_received');
      else expect(results[0].reason.message).toMatch(/刷新/);
      expect(results[1].status).toBe('fulfilled');
      expect(stored('sales_order', 104).shipmentAggregateStatus).toBe('shipped');
    });
    it('rolls back fulfillment changes if their audit insert fails', async () => {
      seed('sales_order', { ...order, receiptStatus: 'deposit_received' });
      jest.spyOn(database.db.operationLog, 'create').mockRejectedValueOnce(new Error('Audit unavailable'));
      await expect(service.syncOperationalAggregates({ salesOrderId: 104, shipmentAggregateStatus: 'shipped',
        operatorId: 9008, source: 'shipment_batch' })).rejects.toThrow('Audit unavailable');
      expect(stored('sales_order', 104)).toMatchObject({ receiptStatus: 'deposit_received', shipmentAggregateStatus: 'not_started' });
      expect(database.logs).toHaveLength(0);
    });
    it('maps the known database record-changed error to a refresh conflict without writes', async () => {
      const error = Object.assign(new Error('Record has changed since last read'), {
        name: 'DriverAdapterError', cause: { originalCode: '1020' },
      });
      jest.spyOn(database.db.businessDocument, 'updateMany').mockRejectedValueOnce(error);
      await expect(service.updateReceiptStatus({ salesOrderId: 104, receiptStatus: 'deposit_received' })).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/刷新/) });
      expect(stored('sales_order', 104).receiptStatus).toBe('unpaid');
      expect(database.logs).toHaveLength(0);
    });
    it('rolls back a receipt mutation if its audit insert fails', async () => {
      jest.spyOn(database.db.operationLog, 'create').mockRejectedValueOnce(new Error('Audit unavailable'));
      await expect(service.updateReceiptStatus({ salesOrderId: 104, receiptStatus: 'deposit_received' })).rejects.toThrow('Audit unavailable');
      expect(stored('sales_order', 104)).toMatchObject({ receiptStatus: 'unpaid', financeStatus: 'pending' });
      expect(database.logs).toHaveLength(0);
    });
    it('uses the original raw JSON for compare-and-swap of legacy payloads with missing normalized defaults', async () => {
      const row = database.documents.get(104)!;
      delete row.payload.stockOutStatus; delete row.payload.stockOutDocNo;
      delete row.payload.salesOrderAttachments;
      await service.updateReceiptStatus({ salesOrderId: 104, receiptStatus: 'deposit_received' });
      expect(stored('sales_order', 104).receiptStatus).toBe('deposit_received');
      expect(database.logs).toHaveLength(1);
    });
    it('reports a refresh conflict when the JSON compare-and-swap affects no document', async () => {
      jest.spyOn(database.db.businessDocument, 'updateMany').mockResolvedValueOnce({ count: 0 });
      await expect(service.updateReceiptStatus({ salesOrderId: 104, receiptStatus: 'deposit_received' })).rejects.toThrow(/刷新/);
      expect(stored('sales_order', 104).receiptStatus).toBe('unpaid');
      expect(database.logs).toHaveLength(0);
    });
  }

  it('persists only the explicitly selected receipt state with the actual operator audit', async () => {
    const controller = new SalesOrderController(service);
    await (controller.updateReceiptStatus as any)(104, { receiptStatus: 'deposit_received' }, '9007');
    expect(stored('sales_order', 104)).toMatchObject({ receiptStatus: 'deposit_received', financeStatus: 'pending' });
    const audit = await service.listAuditLogs(104);
    expect(audit.items).toContainEqual(expect.objectContaining({ operatorId: 9007, operationType: 'update_receipt_status',
      beforeData: expect.objectContaining({ receiptStatus: 'unpaid' }), afterData: expect.objectContaining({ receiptStatus: 'deposit_received' }) }));
  });
  it.each(['', 'paid', 'FULLY_PAID'])('rejects unsupported receipt state %p without modifying the order', async receiptStatus => {
    await expect(service.updateReceiptStatus({ salesOrderId: 104, receiptStatus })).rejects.toThrow();
    expect(stored('sales_order', 104).receiptStatus).toBe('unpaid');
  });
  it('does not confirm finance from a forged paid state in the request', async () => {
    await expect(service.confirmFinance({ salesOrderId: 104, receiptStatus: 'fully_paid', financeStatus: 'confirmed' })).rejects.toThrow(/paid state/);
    expect(stored('sales_order', 104)).toMatchObject({ receiptStatus: 'unpaid', financeStatus: 'pending' });
  });
  it('confirms the saved deposit state without converting it to full payment and audits the actor', async () => {
    seed('sales_order', { ...order, receiptStatus: 'deposit_received' });
    const controller = new SalesOrderController(service);
    await (controller.confirmFinance as any)(104, { receiptStatus: 'fully_paid', financeStatus: 'confirmed' }, '9008');
    expect(stored('sales_order', 104)).toMatchObject({ receiptStatus: 'deposit_received', financeStatus: 'confirmed' });
    expect((await service.listAuditLogs(104)).items).toContainEqual(expect.objectContaining({ operatorId: 9008, operationType: 'confirm_finance' }));
  });
  it.each(['receipt', 'finance', 'reject', 'cancel'])('does not report %s success for a nonexistent sales order', async operation => {
    const action = operation === 'receipt' ? service.updateReceiptStatus({ salesOrderId: 999, receiptStatus: 'fully_paid' })
      : operation === 'finance' ? service.confirmFinance({ salesOrderId: 999, receiptStatus: 'fully_paid', financeStatus: 'confirmed' })
      : operation === 'reject' ? service.reject({ salesOrderId: 999, currentStatus: 'pending_sales_manager_approval', rejectionReason: 'Correct price' } as any)
      : service.cancel({ salesOrderId: 999, currentStatus: 'purchasing', hasShipmentBatches: false, unshippedPurchaseOrderIds: [], cancelReason: 'Actual reason' });
    await expect(action).rejects.toThrow('销售单不存在');
  });
  it.each([123, {}, []])('rejects non-string rejection reason %p with a client error and no changes', async rejectionReason => {
    seed('sales_order', { ...order, status: 'pending_sales_manager_approval' });
    await expect(service.reject({ salesOrderId: 104, currentStatus: 'pending_sales_manager_approval', rejectionReason } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(stored('sales_order', 104).status).toBe('pending_sales_manager_approval');
    expect((await service.listAuditLogs(104)).items).toHaveLength(0);
  });
  it.each([123, {}, []])('rejects non-string cancellation reason %p with a client error and no changes', async cancelReason => {
    seed('purchase_order', purchase(301));
    await expect(service.cancel({ salesOrderId: 104, currentStatus: 'purchasing', cancelReason } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(stored('sales_order', 104).status).toBe('purchasing');
    expect(stored('purchase_order', 301).status).toBe('purchasing');
    const purchaseLogs = mode === 'prisma' ? database.logs.filter(log => log.bizType === 'purchase_order') : resolvePurchaseOrderStore().listAuditLogs();
    expect(purchaseLogs).toHaveLength(0);
    expect((await service.listAuditLogs(104)).items).toHaveLength(0);
  });
  it('requires a real rejection reason', async () => {
    seed('sales_order', { ...order, status: 'pending_sales_manager_approval' });
    await expect(service.reject({ salesOrderId: 104, currentStatus: 'pending_sales_manager_approval', rejectionReason: '   ' } as any)).rejects.toThrow(/原因/);
    expect(stored('sales_order', 104).status).toBe('pending_sales_manager_approval');
  });
  it('persists the supervisor modification request for the sales user', async () => {
    seed('sales_order', { ...order, status: 'pending_sales_manager_approval' });
    const controller = new SalesOrderController(service);
    await (controller.reject as any)(104, { currentStatus: 'pending_sales_manager_approval', rejectionReason: '  单价低于成本，请调整  ' }, '9010');
    expect(stored('sales_order', 104)).toMatchObject({ status: 'rejected', rejectionReason: '单价低于成本，请调整' });
    expect((await service.listAuditLogs(104)).items).toContainEqual(expect.objectContaining({ operatorId: 9010,
      afterData: expect.objectContaining({ rejectionReason: '单价低于成本，请调整' }) }));
  });
  it('checks the saved rejection status rather than trusting the submitted status', async () => {
    await expect(service.reject({ salesOrderId: 104, currentStatus: 'pending_sales_manager_approval', rejectionReason: 'Correct price' } as any)).rejects.toThrow();
    expect(stored('sales_order', 104).status).toBe('purchasing');
  });
  it('requires a cancellation reason', async () => {
    await expect(service.cancel({ salesOrderId: 104, currentStatus: 'purchasing', hasShipmentBatches: false, unshippedPurchaseOrderIds: [], cancelReason: '  ' })).rejects.toThrow(/原因/);
  });
  it('voids the actual unshipped linked purchases while ignoring caller-supplied ids', async () => {
    seed('purchase_order', purchase(301)); seed('purchase_order', purchase(302, 104, 'pending_purchase_claim'));
    seed('purchase_order', purchase(303, 105)); seed('purchase_order', purchase(304, 104, 'void'));
    const result = await service.cancel({ salesOrderId: 104, operatorId: 9007, currentStatus: 'purchasing', hasShipmentBatches: false,
      unshippedPurchaseOrderIds: [303], cancelReason: '  客户修改规格，本单撤销  ' });
    expect(result.autoVoidedPurchaseOrderIds.sort()).toEqual([301, 302]);
    expect(stored('sales_order', 104)).toMatchObject({ status: 'void', cancelReason: '客户修改规格，本单撤销', autoVoidedPurchaseOrderIds: [301, 302] });
    expect(stored('purchase_order', 301)).toMatchObject({ status: 'void', cancelReason: '客户修改规格，本单撤销' });
    expect(stored('purchase_order', 302).status).toBe('void');
    expect(stored('purchase_order', 303).status).toBe('purchasing');
    const logs = mode === 'prisma' ? database.logs : resolvePurchaseOrderStore().listAuditLogs();
    expect(logs).toContainEqual(expect.objectContaining({ bizType: 'purchase_order',
      operatorId: mode === 'prisma' ? 9007n : 9007, afterData: expect.objectContaining({ status: 'void' }) }));
    expect((await service.listAuditLogs(104)).items).toContainEqual(expect.objectContaining({ operatorId: 9007, operationType: 'cancel_sales_order' }));
  });
  it('blocks cancellation if a real shipment exists despite a false request flag', async () => {
    seed('purchase_order', purchase(301)); seed('shipment_batch', shipment());
    await expect(service.cancel({ salesOrderId: 104, currentStatus: 'purchasing', hasShipmentBatches: false, unshippedPurchaseOrderIds: [], cancelReason: 'Actual reason' })).rejects.toThrow(/shipment/);
    expect(stored('sales_order', 104).status).toBe('purchasing');
    expect(stored('purchase_order', 301).status).toBe('purchasing');
  });
  it('blocks cancellation when an actual linked purchase is partly shipped', async () => {
    seed('purchase_order', purchase(301, 104, 'partial_shipped'));
    await expect(service.cancel({ salesOrderId: 104, currentStatus: 'purchasing', hasShipmentBatches: false, unshippedPurchaseOrderIds: [], cancelReason: 'Actual reason' })).rejects.toThrow(/shipment/);
    expect(stored('purchase_order', 301).status).toBe('partial_shipped');
  });
  it('checks the saved sales status before cancellation', async () => {
    seed('sales_order', { ...order, status: 'shipped' });
    await expect(service.cancel({ salesOrderId: 104, currentStatus: 'purchasing', hasShipmentBatches: false, unshippedPurchaseOrderIds: [], cancelReason: 'Actual reason' })).rejects.toThrow();
    expect(stored('sales_order', 104).status).toBe('shipped');
  });
});

describe('sales mutation ownership', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'erp-sales-ownership-'));
    process.env.ERP_DATA_DIR = dir;
    resolveSalesOrderStore().upsertSalesOrder(order);
  });
  afterEach(() => { delete process.env.ERP_DATA_DIR; rmSync(dir, { recursive: true, force: true }); });
  it.each(['cancel', 'receipt', 'finance', 'reject'])('prevents an own-scope user mutating another user order via %s', async operation => {
    const controller = new SalesOrderController(new SalesOrderService());
    const headers = ['9007', 'boss', undefined, 'own_sales'];
    const action = operation === 'cancel' ? (controller.cancel as any)(104, { currentStatus: 'purchasing', hasShipmentBatches: false, unshippedPurchaseOrderIds: [], cancelReason: 'Actual reason' }, ...headers)
      : operation === 'receipt' ? (controller.updateReceiptStatus as any)(104, { receiptStatus: 'fully_paid' }, ...headers)
      : operation === 'finance' ? (controller.confirmFinance as any)(104, { financeStatus: 'confirmed' }, ...headers)
      : (controller.reject as any)(104, { currentStatus: 'pending_sales_manager_approval', rejectionReason: 'Correct price' }, ...headers);
    await expect(action).rejects.toThrow('销售单不存在');
    expect(resolveSalesOrderStore().getSalesOrder(104)?.status).toBe('purchasing');
    expect(resolveSalesOrderStore().getSalesOrder(104)?.receiptStatus).toBe('unpaid');
  });
});
