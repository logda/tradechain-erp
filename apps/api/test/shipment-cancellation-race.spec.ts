import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SalesOrderService, type CreatedSalesOrderRecord } from '../src/sales-order/sales-order.service';
import { resolveSalesOrderStore } from '../src/sales-order/sales-order.store';
import { PurchaseOrderService, type CreatedPurchaseOrderRecord } from '../src/purchase-order/purchase-order.service';
import { resolvePurchaseOrderStore } from '../src/purchase-order/purchase-order.store';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import { resolveShipmentBatchStore } from '../src/shipment-batch/shipment-batch.store';
import type { PrismaService } from '../src/storage/prisma.service';

const sale: CreatedSalesOrderRecord = {
  id: 104, salesNo: 'S104', status: 'purchasing', currentVersionNo: 1,
  purchaseAggregateStatus: 'purchasing', shipmentAggregateStatus: 'not_started',
  receiptSendStatus: 'pending', afterSalesEndStatus: 'not_started', receiptStatus: 'unpaid',
  financeStatus: 'pending', createdBy: 2001, createdAt: '2026-09-28T02:00:00.000Z',
  sourceMode: 'direct', customerName: 'Customer', title: 'Sale', salesUserId: 2001,
  versionHistory: [], items: [],
};
const purchase: CreatedPurchaseOrderRecord = {
  id: 301, purchaseNo: 'P301', sourceSalesOrderId: 104, supplierId: 1, supplierName: 'Factory',
  ownerName: 'Buyer', currentVersionNo: 1, status: 'purchasing', itemCount: 0, createdBy: 2002,
  createdAt: sale.createdAt, salesOrderNo: 'S104', currentBatchCount: 0, versionHistory: [], items: [],
};
const shipment = {
  salesOrderId: 104, purchaseOrderId: 301, shippedQty: 1, accumulatedQty: 1, remainingQty: 0,
  shippedAt: sale.createdAt, shippingCode: 'SHIP-104', createdBy: 2002,
  purchaseOrderCurrentStatus: 'purchasing', currentBatchCount: 0,
};

describe('shipment creation competing with cancellation', () => {
  let dir: string;
  const originalMode = process.env.ERP_STORAGE_MODE;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'erp-shipment-cancel-race-'));
    process.env.ERP_DATA_DIR = dir;
    delete process.env.ERP_STORAGE_MODE;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.ERP_DATA_DIR;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    rmSync(dir, { recursive: true, force: true });
  });

  it('runtime refuses a shipment whose real source sale was cancelled during metadata loading', async () => {
    resolveSalesOrderStore().upsertSalesOrder(sale);
    resolvePurchaseOrderStore().upsertPurchaseOrder(purchase);
    const sales = new SalesOrderService();
    const purchases = new PurchaseOrderService();
    const batches = new ShipmentBatchService(undefined, sales, purchases);
    const getPurchase = purchases.getDetail.bind(purchases);
    let release!: () => void;
    let entered!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    let reads = 0;
    jest.spyOn(purchases, 'getDetail').mockImplementation(async (id, session) => {
      const detail = await getPurchase(id, session);
      if (++reads === 2) { entered(); await gate; }
      return detail;
    });
    const creating = batches.create(shipment);
    await waiting;
    await sales.cancel({ salesOrderId: 104, currentStatus: 'purchasing', hasShipmentBatches: false,
      unshippedPurchaseOrderIds: [301], cancelReason: '客户调整采购计划' });
    release();
    await expect(creating).rejects.toThrow();
    expect(resolveSalesOrderStore().getSalesOrder(104)?.status).toBe('void');
    expect(resolvePurchaseOrderStore().getPurchaseOrder(301)?.status).toBe('void');
    expect(resolveShipmentBatchStore().listShipmentBatches()).toEqual([]);
    expect(resolveShipmentBatchStore().listAuditLogs()).toEqual([]);
  });

  it('runtime refuses a shipment whose purchase was cancelled after its status was read', async () => {
    resolveSalesOrderStore().upsertSalesOrder(sale);
    resolvePurchaseOrderStore().upsertPurchaseOrder(purchase);
    const sales = new SalesOrderService();
    const purchases = new PurchaseOrderService();
    const batches = new ShipmentBatchService(undefined, sales, purchases);
    const getSale = sales.getDetail.bind(sales);
    let release!: () => void;
    let entered!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    jest.spyOn(sales, 'getDetail').mockImplementation(async (id, session) => {
      const detail = await getSale(id, session);
      entered(); await gate;
      return detail;
    });
    const creating = batches.create(shipment);
    await waiting;
    await purchases.cancel({ purchaseOrderId: 301, currentStatus: 'purchasing', hasShipmentBatches: false, cancelReason: '供应商交期无法满足' });
    release();
    await expect(creating).rejects.toThrow();
    expect(resolvePurchaseOrderStore().getPurchaseOrder(301)?.status).toBe('void');
    expect(resolveShipmentBatchStore().listShipmentBatches()).toEqual([]);
    expect(resolveShipmentBatchStore().listAuditLogs()).toEqual([]);
  });

  function database(onLock?: (documents: Map<number, any>) => void, failFinalNumber = false) {
    const documents = new Map<number, any>();
    for (const [bizType, payload, docNo] of [['sales_order', sale, sale.salesNo], ['purchase_order', purchase, purchase.purchaseNo]] as const) {
      documents.set(payload.id, { id: BigInt(payload.id), bizType, docNo, status: payload.status,
        payload: structuredClone(payload), createdBy: BigInt(payload.createdBy), createdAt: new Date(payload.createdAt), updatedAt: new Date(payload.createdAt) });
    }
    const logs: any[] = [];
    const events: string[] = [];
    let active = false;
    const db: any = {
      businessDocument: {
        findMany: async ({ where }: any) => [...documents.values()].filter(row => row.bizType === where.bizType).map(row => structuredClone(row)),
        findUnique: async ({ where }: any) => {
          events.push(`read:${where.id}`);
          return structuredClone(documents.get(Number(where.id)) ?? null);
        },
        create: async ({ data }: any) => {
          events.push('create');
          const row = { ...structuredClone(data), id: 401n, createdAt: new Date(sale.createdAt), updatedAt: new Date(sale.createdAt) };
          documents.set(401, row);
          return row;
        },
        update: async ({ where, data }: any) => {
          events.push('number');
          if (failFinalNumber) throw new Error('Number update failed');
          const row = { ...documents.get(Number(where.id)), ...structuredClone(data) };
          documents.set(Number(where.id), row);
          return row;
        },
      },
      operationLog: {
        create: async ({ data }: any) => { events.push('log'); logs.push(structuredClone(data)); return { id: 1n }; },
      },
      $queryRaw: async (strings: TemplateStringsArray, id: bigint) => {
        events.push(`lock:${id}`);
        expect(strings.join('?')).toContain('FOR UPDATE');
        expect(active).toBe(true);
        onLock?.(documents);
        return [{ id }];
      },
      $transaction: async (operation: (tx: any) => Promise<unknown>) => {
        const before = structuredClone(documents);
        active = true; events.push('begin');
        try {
          const result = await operation(db);
          events.push('commit'); return result;
        } catch (error) {
          documents.clear(); before.forEach((value, key) => documents.set(key, value));
          logs.splice(0); events.push('rollback'); throw error;
        } finally { active = false; }
      },
    };
    const realSales = new SalesOrderService(db as PrismaService);
    const sales = {
      list: realSales.list.bind(realSales),
      getDetail: async () => ({ ...structuredClone(sale), customerFullName: undefined, stockOutStatus: 'not_started', stockOutDocNo: null }),
      syncOperationalAggregates: async () => {
        expect(active).toBe(false); events.push('sync');
        return { id: 104, status: 'purchasing', purchaseAggregateStatus: 'purchasing', shipmentAggregateStatus: 'shipped',
          receiptSendStatus: 'pending', afterSalesEndStatus: 'not_started', receiptStatus: 'unpaid', financeStatus: 'pending' };
      },
    };
    return { db: db as PrismaService, documents, logs, events, sales };
  }

  it.each([['sales_order', 104], ['purchase_order', 301]] as const)('Prisma rejects a %s voided before the source lock is acquired', async (_type, id) => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const { db, documents, logs, sales } = database(rows => {
      const row = rows.get(id);
      rows.set(id, { ...row, status: 'void', payload: { ...row.payload, status: 'void' } });
    });
    await expect(new ShipmentBatchService(db, sales).create(shipment)).rejects.toThrow();
    expect([...documents.values()].filter(row => row.bizType === 'shipment_batch')).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('Prisma locks sales then purchase before reading source state and commits before cross-service sync', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const { db, documents, logs, events, sales } = database();
    const result = await new ShipmentBatchService(db, sales).create(shipment);
    expect(events).toEqual(['begin', 'lock:104', 'lock:301', 'read:104', 'read:301', 'create', 'number', 'log', 'commit', 'sync']);
    expect(documents.get(401)?.docNo).toBe(result.batchNo);
    expect(logs).toEqual([expect.objectContaining({ operationType: 'create_shipment_batch', afterData: expect.objectContaining({ id: 401, batchNo: result.batchNo }) })]);
  });

  it('Prisma rolls back batch creation when the final number cannot be saved', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const { db, documents, logs, sales } = database(undefined, true);
    await expect(new ShipmentBatchService(db, sales).create(shipment)).rejects.toThrow('Number update failed');
    expect([...documents.values()].filter(row => row.bizType === 'shipment_batch')).toEqual([]);
    expect(logs).toEqual([]);
  });
});
