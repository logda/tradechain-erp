import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AuditController } from '../src/audit/audit.controller';
import { AuditService } from '../src/audit/audit.service';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { resolveSalesOrderStore } from '../src/sales-order/sales-order.store';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { resolvePurchaseOrderStore } from '../src/purchase-order/purchase-order.store';
import { ShipmentBatchController } from '../src/shipment-batch/shipment-batch.controller';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import { resolveShipmentBatchStore } from '../src/shipment-batch/shipment-batch.store';
import { AfterSalesController } from '../src/after-sales/after-sales.controller';
import { AfterSalesService } from '../src/after-sales/after-sales.service';
import { resolveAfterSalesStore } from '../src/after-sales/after-sales.store';
import { QuoteService } from '../src/quote/quote.service';
import { InquiryService } from '../src/inquiry/inquiry.service';
import { SampleOrderService } from '../src/sample-order/sample-order.service';
import { CounterpartyService } from '../src/counterparty/counterparty.service';
import { ProductService } from '../src/product/product.service';
import { UserManagementService } from '../src/user-management/user-management.service';
import type { PrismaService } from '../src/storage/prisma.service';

const modules = [
  { route: 'sales-orders', bizType: 'sales_order', Service: SalesOrderService, store: resolveSalesOrderStore },
  { route: 'purchase-orders', bizType: 'purchase_order', Service: PurchaseOrderService, store: resolvePurchaseOrderStore },
  { route: 'shipment-batches', bizType: 'shipment_batch', Service: ShipmentBatchService, store: resolveShipmentBatchStore },
  { route: 'after-sales', bizType: 'after_sales', Service: AfterSalesService, store: resolveAfterSalesStore },
] as const;

describe('document audit scope', () => {
  let app: INestApplication;
  let dataDir: string;
  const originalMode = process.env.ERP_STORAGE_MODE;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-document-audit-'));
    process.env.ERP_DATA_DIR = dataDir;
    process.env.ERP_STORAGE_MODE = 'runtime';
    for (const module of modules) {
      for (const bizId of [104, 105]) {
        module.store().recordAuditLog({
          bizType: module.bizType,
          bizId, operationType: bizId === 104 ? 'submit' : 'reject', operatorId: 7001,
          beforeData: { status: 'draft' }, afterData: { status: 'pending_approval' },
        } as never);
      }
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditController, SalesOrderController, PurchaseOrderController, ShipmentBatchController, AfterSalesController],
      providers: [
        AuditService, SalesOrderService, PurchaseOrderService, ShipmentBatchService, AfterSalesService,
        ...[QuoteService, InquiryService, SampleOrderService, CounterpartyService, ProductService].map((provide) => ({
          provide, useValue: { listAuditLogs: async () => ({ items: [] }) },
        })),
        { provide: UserManagementService, useValue: { listOperatorDirectory: async () => [{ id: 7001, username: 'new-sales', realName: '新销售' }] } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    delete process.env.ERP_DATA_DIR;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    rmSync(dataDir, { recursive: true, force: true });
  });

  function get(path: string, actions = 'audit.view', grantedModules = 'sales,purchase,operations') {
    return request(app.getHttpServer()).get(path).set({
      'x-erp-role': 'boss', 'x-erp-user': 'Mia', 'x-erp-actions': actions, 'x-erp-modules': grantedModules,
    });
  }

  it.each(modules)('$route filters runtime logs by current document and keeps module-wide requests complete', async ({ route, bizType }) => {
    const scoped = await get(`/${route}/audit-logs?bizId=104`).expect(200);
    expect(scoped.body.items).toHaveLength(1);
    expect(scoped.body.items[0]).toMatchObject({ bizType, bizId: 104, operationType: 'submit' });
    const all = await get(`/${route}/audit-logs`).expect(200);
    expect(all.body.items.map((item: { bizId: number }) => item.bizId)).toEqual([104, 105]);
  });

  it.each(modules)('$route scopes Prisma audit queries by business type and document ID', async ({ Service, bizType }) => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const findMany = jest.fn().mockResolvedValue([{
      id: 1n, bizType, bizId: 104n, operationType: 'submit', operatorId: 7001n,
      beforeData: { status: 'draft' }, afterData: { status: 'pending_approval' }, createdAt: new Date('2026-09-28T01:00:00Z'),
    }]);
    const service = new Service({ operationLog: { findMany } } as unknown as PrismaService);
    const result = await service.listAuditLogs(104);
    expect(findMany).toHaveBeenCalledWith({ where: { bizType, bizId: 104n }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    expect(result.items[0]).toMatchObject({ bizId: 104, operatorId: 7001, beforeData: { status: 'draft' }, afterData: { status: 'pending_approval' } });
  });

  it.each(modules)('central $route document logs retain real operator names while the center retains all documents', async ({ bizType }) => {
    const scoped = await get(`/audit-logs?bizType=${bizType}&bizId=104`).expect(200);
    expect(scoped.body.items).toHaveLength(1);
    expect(scoped.body.items[0]).toMatchObject({ bizType, bizId: 104, operatorId: 7001, operatorName: '新销售' });
    const all = await get('/audit-logs').expect(200);
    expect(all.body.items).toHaveLength(8);
  });

  it.each(modules)('$route document filtering does not grant audit access or bypass module access', async ({ route, bizType }) => {
    await get(`/${route}/audit-logs?bizId=104`, 'sales.order.write').expect(403);
    await get(`/${route}/audit-logs?bizId=104`, 'audit.view', 'home').expect(403);
    await get(`/audit-logs?bizType=${bizType}&bizId=104`, 'sales.order.write').expect(403);
  });

  it.each(['invalid', '0', '-1', '104.5', ''])('rejects invalid audit document ID %j rather than returning unrelated records', async (bizId) => {
    await get(`/sales-orders/audit-logs?bizId=${bizId}`).expect(400);
    await get(`/audit-logs?bizType=sales_order&bizId=${bizId}`).expect(400);
  });
});
