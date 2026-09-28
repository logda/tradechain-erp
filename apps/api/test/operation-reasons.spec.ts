import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { PurchaseOrderService, type CreatedPurchaseOrderRecord } from '../src/purchase-order/purchase-order.service';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';
import { resolvePurchaseOrderStore } from '../src/purchase-order/purchase-order.store';
import { AfterSalesService, type CreatedAfterSalesRecord } from '../src/after-sales/after-sales.service';
import { AfterSalesController } from '../src/after-sales/after-sales.controller';
import { resolveAfterSalesStore } from '../src/after-sales/after-sales.store';
import { ShipmentBatchService, type CreatedShipmentBatchRecord } from '../src/shipment-batch/shipment-batch.service';
import { ShipmentBatchController } from '../src/shipment-batch/shipment-batch.controller';
import { resolveShipmentBatchStore } from '../src/shipment-batch/shipment-batch.store';
import type { PrismaService } from '../src/storage/prisma.service';

const actions = [
  { name: 'purchase rejection', bizType: 'purchase_order', status: 'pending_purchase_manager_approval', nextStatus: 'draft', input: 'rejectionReason', stored: 'rejectionReason', operation: 'reject_purchase_order' },
  { name: 'purchase cancellation', bizType: 'purchase_order', status: 'purchasing', nextStatus: 'void', input: 'cancelReason', stored: 'cancelReason', operation: 'cancel_purchase_order' },
  { name: 'after-sales rejection', bizType: 'after_sales', status: 'pending_approval', nextStatus: 'pending_submit', input: 'rejectionReason', stored: 'rejectionReason', operation: 'reject_after_sales' },
  { name: 'shipment exception', bizType: 'shipment_batch', status: 'shipped', nextStatus: 'exception', input: 'reason', stored: 'exceptionReason', operation: 'mark_shipment_exception' },
] as const;

describe.each(['runtime', 'prisma'])('real operation reasons in %s storage', (mode) => {
  let dir: string;
  const originalMode = process.env.ERP_STORAGE_MODE;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'erp-operation-reasons-'));
    process.env.ERP_DATA_DIR = dir;
    process.env.ERP_STORAGE_MODE = mode;
  });
  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    rmSync(dir, { recursive: true, force: true });
  });

  function prepare(action: typeof actions[number], persistedStatus: string = action.status, exists = true) {
    const createdAt = '2026-09-28T01:00:00.000Z';
    const purchase: CreatedPurchaseOrderRecord = {
      id: 101, purchaseNo: 'C2609280101', sourceSalesOrderId: 88,
      supplierId: 3001, supplierName: '供应商', ownerName: '采购员', ownerId: 57,
      currentVersionNo: 1, status: persistedStatus, itemCount: 0, createdBy: 57,
      createdAt, salesOrderNo: 'S2609280088', currentBatchCount: 0, versionHistory: [], items: [],
    };
    const afterSales: CreatedAfterSalesRecord = {
      id: 101, afterSalesNo: 'AS2609280101', status: persistedStatus, financeReviewStatus: 'pending',
      salesOrderId: 88, purchaseOrderId: 21, shipmentBatchId: 100, type: 'refund',
      issueDescription: '物流延误申请退款', createdBy: 57, createdAt,
      customerName: '客户', supplierName: '供应商', ownerName: '采购员',
      receiptCollectionStatus: 'unpaid', title: '退款处理', items: [],
    };
    const shipment: CreatedShipmentBatchRecord = {
      id: 101, batchNo: 'SH2609280101', status: persistedStatus, receiptSendStatus: 'pending',
      shippedQty: 10, accumulatedQty: 10, remainingQty: 0, shippedAt: createdAt,
      createdBy: 57, salesOrderId: 88, purchaseOrderId: 21, purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 1, salesOrderLocked: true, supplierName: '供应商',
      salesOrderNo: 'S2609280088', purchaseOrderNo: 'C2609280021', title: '发货',
      createdAt, hasException: false, items: [],
    };
    const payload = action.bizType === 'purchase_order' ? purchase : action.bizType === 'after_sales' ? afterSales : shipment;
    if (exists) {
      resolvePurchaseOrderStore().upsertPurchaseOrder(purchase);
      resolveAfterSalesStore().upsertAfterSalesOrder(afterSales);
      resolveShipmentBatchStore().upsertShipmentBatch(shipment);
    }
    let document = {
      id: 101n, bizType: action.bizType,
      docNo: action.bizType === 'purchase_order' ? purchase.purchaseNo : action.bizType === 'after_sales' ? afterSales.afterSalesNo : shipment.batchNo,
      status: persistedStatus, ownerUserId: 57n, counterpartyId: 3001n,
      payload, createdBy: 57n, createdAt: new Date(createdAt), updatedAt: new Date(createdAt),
    };
    const logs: any[] = [];
    // Only the external DB boundary is replaced; updates feed subsequent detail/log reads.
    const prisma = mode === 'prisma' ? {
      businessDocument: {
        findUnique: async () => exists ? structuredClone(document) : null,
        findMany: async ({ where }: any) => exists && where.bizType === document.bizType ? [structuredClone(document)] : [],
        update: async ({ where, data }: any) => {
          if (where.status && where.status !== document.status) throw new Error('Stale status');
          document = { ...document, ...structuredClone(data) };
          return structuredClone(document);
        },
      },
      operationLog: {
        create: async ({ data }: any) => {
          const log = { ...structuredClone(data), id: BigInt(logs.length + 1), createdAt: new Date(createdAt) };
          logs.push(log);
          return log;
        },
        findMany: async () => structuredClone(logs),
      },
    } as unknown as PrismaService : undefined;
    const service = action.bizType === 'purchase_order' ? new PurchaseOrderService(prisma)
      : action.bizType === 'after_sales' ? new AfterSalesService(prisma) : new ShipmentBatchService(prisma);
    const perform = (reason: unknown) => {
      const body = { currentStatus: action.status, [action.input]: reason, hasShipmentBatches: false };
      if (action.name === 'purchase rejection') return new PurchaseOrderController(service as PurchaseOrderService).reject(101, body as any, '1');
      if (action.name === 'purchase cancellation') return new PurchaseOrderController(service as PurchaseOrderService).cancel(101, body as any, '1');
      if (action.name === 'after-sales rejection') return new AfterSalesController(service as AfterSalesService).reject(101, body as any, '1');
      return new ShipmentBatchController(service as ShipmentBatchService).markException(101, body as any, '管理员', '1');
    };
    const reread = () => {
      const nextService = action.bizType === 'purchase_order' ? new PurchaseOrderService(prisma)
        : action.bizType === 'after_sales' ? new AfterSalesService(prisma) : new ShipmentBatchService(prisma);
      return nextService.getDetail(101);
    };
    return { service, perform, reread };
  }

  if (mode === 'runtime') {
    it('does not mark an arrived batch exceptional after an asynchronous scope check', async () => {
      const { service, reread } = prepare(actions[3], 'forwarder_shipped');
      const shipmentService = service as ShipmentBatchService;
      const outcomes = await Promise.allSettled([
        shipmentService.markException({ shipmentBatchId: 101, currentStatus: 'forwarder_shipped', reason: '物流延误',
          operatorId: 1, session: { role: 'boss', userId: 1, user: 'Mia', dataScope: 'all' } }),
        shipmentService.markArrived({ shipmentBatchId: 101, currentStatus: 'forwarder_shipped' }),
      ]);
      expect(outcomes.map(outcome => outcome.status)).toEqual(['rejected', 'fulfilled']);
      expect(await reread()).toMatchObject({ status: 'arrived', hasException: false });
      expect((await service.listAuditLogs(101)).items.map(log => log.operationType)).toEqual(['mark_shipment_arrived']);
    });
  }

  describe.each(actions)('$name', (action) => {
    it('rejects a missing document without recording a successful action', async () => {
      const { service, perform } = prepare(action, action.status, false);
      await expect(perform('请补充预计到货时间')).rejects.toBeInstanceOf(NotFoundException);
      expect((await service.listAuditLogs(101)).items).toEqual([]);
    });

    it('keeps the entered reason in persisted detail and the authenticated actor in the log', async () => {
      const { service, perform, reread } = prepare(action);
      await perform('  物流延误，请补充预计到货时间  ');
      expect(await reread()).toMatchObject({ status: action.nextStatus, [action.stored]: '物流延误，请补充预计到货时间' });
      const logs = await service.listAuditLogs(101);
      expect(logs.items).toEqual([expect.objectContaining({
        operationType: action.operation, operatorId: 1,
        afterData: expect.objectContaining({ [action.stored]: '物流延误，请补充预计到货时间' }),
      })]);
    });

    it.each([undefined, '', ' \n\t '])('rejects an absent or blank reason (%p) without changing the record or log', async (reason) => {
      const { service, perform, reread } = prepare(action);
      const before = await reread();
      await expect(perform(reason)).rejects.toThrow();
      expect(await reread()).toEqual(before);
      expect((await service.listAuditLogs(101)).items).toEqual([]);
    });

    it('rejects a stale currentStatus without recording the supplied reason', async () => {
      const { service, perform, reread } = prepare(action, 'closed');
      const before = await reread();
      await expect(perform('物流延误')).rejects.toThrow();
      expect(await reread()).toEqual(before);
      expect((await service.listAuditLogs(101)).items).toEqual([]);
    });

    it('preserves role, module, action and own-data restrictions and records the signed actor on HTTP requests', async () => {
      const { service, reread } = prepare(action);
      const Controller = action.bizType === 'purchase_order' ? PurchaseOrderController
        : action.bizType === 'after_sales' ? AfterSalesController : ShipmentBatchController;
      const Service = action.bizType === 'purchase_order' ? PurchaseOrderService
        : action.bizType === 'after_sales' ? AfterSalesService : ShipmentBatchService;
      const module = await Test.createTestingModule({ controllers: [Controller], providers: [{ provide: Service, useValue: service }] }).compile();
      const app = module.createNestApplication();
      await app.init();
      const route = action.bizType === 'purchase_order' ? `/purchase-orders/101/${action.input === 'cancelReason' ? 'cancel' : 'reject'}`
        : action.bizType === 'after_sales' ? '/after-sales/101/reject' : '/shipment-batches/101/mark-exception';
      const moduleCode = action.bizType === 'purchase_order' ? 'purchase' : 'operations';
      const actionCode = action.name === 'shipment exception' ? 'shipment.update'
        : action.name === 'purchase cancellation' ? 'purchase.order.submit' : 'purchase.order.approve';
      const headers = (role: string, modules: string[], allowedActions: string[], dataScope = 'all', userId = 1) => {
        const payload = Buffer.from(JSON.stringify({ role, user: '真实主管', username: 'manager', userId, dataScope, modules, actions: allowedActions, exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
        const signature = createHmac('sha256', process.env.ERP_FORMAL_SESSION_SECRET?.trim() || 'dev-only-insecure-formal-session-secret').update(payload).digest('base64url');
        return { 'x-erp-session': payload, 'x-erp-session-signature': signature, 'x-erp-user-id': '999' };
      };
      const body = { currentStatus: action.status, [action.input]: '请补充预计到货时间', hasShipmentBatches: false };
      const before = await reread();
      try {
        await request(app.getHttpServer()).post(route).set(headers('sales', [moduleCode], [actionCode])).send(body).expect(403);
        await request(app.getHttpServer()).post(route).set(headers('purchase_manager', [], [actionCode])).send(body).expect(403);
        await request(app.getHttpServer()).post(route).set(headers('purchase_manager', [moduleCode], [])).send(body).expect(403);
        await request(app.getHttpServer()).post(route).set(headers('purchase_manager', [moduleCode], [actionCode])).send({ ...body, [action.input]: '  ' }).expect(400);
        const detailRoute = route.slice(0, route.lastIndexOf('/'));
        await request(app.getHttpServer()).get(detailRoute).set(headers('purchase_manager', [moduleCode], [actionCode], 'own_purchase')).expect(404);
        await request(app.getHttpServer()).post(route).set(headers('purchase_manager', [moduleCode], [actionCode], 'own_purchase')).send(body).expect(404);
        expect(await reread()).toEqual(before);
        expect((await service.listAuditLogs(101)).items).toEqual([]);
        await request(app.getHttpServer()).get(detailRoute).set(headers('purchase_manager', [moduleCode], [actionCode], 'own_purchase', 57)).expect(200);
        await request(app.getHttpServer()).post(route).set(headers('purchase_manager', [moduleCode], [actionCode], 'own_purchase', 57)).send(body).expect(201);
        expect(await reread()).toMatchObject({ [action.stored]: '请补充预计到货时间' });
        expect((await service.listAuditLogs(101)).items[0]).toMatchObject({ operatorId: 57 });
      } finally {
        await app.close();
      }
    });
  });
});
