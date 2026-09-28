import { Test, type TestingModule } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/storage/prisma.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';

// This suite runs only against an explicitly supplied, migrated and seeded test database.
const describeDatabase = process.env.ERP_TEST_DATABASE_URL ? describe : describe.skip;

describeDatabase('batch 2 concurrent operations in real Prisma storage', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let sales: SalesOrderService;
  let purchases: PurchaseOrderService;
  let shipments: ShipmentBatchService;
  const salesIds = new Set<number>();
  const documentIds = new Set<number>();
  const originalUrl = process.env.DATABASE_URL;
  const originalMode = process.env.ERP_STORAGE_MODE;
  const originalDataDir = process.env.ERP_DATA_DIR;
  let runtimeDir: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.ERP_TEST_DATABASE_URL;
    process.env.ERP_STORAGE_MODE = 'prisma';
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-prisma-concurrency-'));
    process.env.ERP_DATA_DIR = runtimeDir;
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = module.get(PrismaService);
    await prisma.$connect();
    sales = module.get(SalesOrderService);
    purchases = module.get(PurchaseOrderService);
    shipments = module.get(ShipmentBatchService);
  });

  afterEach(async () => {
    const batches = await prisma.businessDocument.findMany({ where: { bizType: 'shipment_batch' } });
    for (const batch of batches) {
      if (salesIds.has(Number((batch.payload as any).salesOrderId))) documentIds.add(Number(batch.id));
    }
    const ids = [...documentIds].map(BigInt);
    await prisma.operationLog.deleteMany({ where: { bizType: { in: ['sales_order', 'purchase_order', 'shipment_batch'] }, bizId: { in: ids } } });
    await prisma.businessDocument.deleteMany({ where: { id: { in: ids } } });
    salesIds.clear(); documentIds.clear();
  });

  afterAll(async () => {
    await module.close();
    rmSync(runtimeDir, { recursive: true, force: true });
    if (originalDataDir === undefined) delete process.env.ERP_DATA_DIR;
    else process.env.ERP_DATA_DIR = originalDataDir;
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
  });

  async function approvedSale() {
    const order = await sales.create({ customerId: 1001, customerName: 'Acme Trading',
      title: '独立并发验证', salesUserId: 3, createdBy: 3,
      items: [{ lineNo: 1, productId: 501, sku: 'SKU-LED-001', productName: '灯带', unit: '件', quantity: 10, salePrice: 12.35, amount: 123.5 }],
    });
    salesIds.add(order.id); documentIds.add(order.id);
    await sales.submit({ salesOrderId: order.id, currentStatus: 'draft' });
    await sales.approve({ salesOrderId: order.id, currentStatus: 'pending_sales_manager_approval', purchaseOwnerName: 'Leo', purchaseOwnerId: 4, operatorId: 1 });
    return order;
  }

  it('does not restore an old paid state when receipt registration races with review', async () => {
    const order = await approvedSale();
    await sales.updateReceiptStatus({ salesOrderId: order.id, receiptStatus: 'deposit_received', operatorId: 1 });
    const outcomes = await Promise.allSettled([
      sales.updateReceiptStatus({ salesOrderId: order.id, receiptStatus: 'unpaid', operatorId: 1 }),
      sales.confirmFinance({ salesOrderId: order.id, operatorId: 1 }),
    ]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    const saved = await sales.getDetail(order.id);
    if (outcomes[0].status === 'fulfilled') expect(saved).toMatchObject({ receiptStatus: 'unpaid', financeStatus: 'pending' });
    else expect(saved).toMatchObject({ receiptStatus: 'deposit_received', financeStatus: 'confirmed' });
    expect((await sales.listAuditLogs(order.id)).items.filter(log => ['update_receipt_status', 'confirm_finance'].includes(log.operationType))).toHaveLength(2);
  });

  it.each([false, true])('preserves a successful receipt registration during fulfillment sync (sync first: %s)', async syncFirst => {
    const order = await approvedSale();
    const register = () => sales.updateReceiptStatus({ salesOrderId: order.id, receiptStatus: 'deposit_received', operatorId: 1 });
    const sync = () => sales.syncOperationalAggregates({ salesOrderId: order.id, shipmentAggregateStatus: 'partial_shipped', source: 'shipment_batch', operatorId: 4 });
    const outcomes = await Promise.allSettled(syncFirst ? [sync(), register()] : [register(), sync()]);
    const receiptResult = outcomes[syncFirst ? 1 : 0];
    const saved = await sales.getDetail(order.id);
    expect(saved.shipmentAggregateStatus).toBe('partial_shipped');
    if (receiptResult.status === 'fulfilled') expect(saved.receiptStatus).toBe('deposit_received');
    else expect(receiptResult.reason.message).toMatch(/刷新/);
  });

  it.each([false, true])('keeps cancellation and shipment mutually exclusive (shipment first: %s)', async shipmentFirst => {
    const order = await approvedSale();
    const created = await purchases.createFromSalesOrder({ salesOrderId: order.id, createdBy: 1, ownerId: 4, ownerName: 'Leo',
      items: [{ salesItemId: 1, supplierId: 3001, supplierName: 'Acme Supply', productId: 501, sku: 'SKU-LED-001', productName: '灯带', unit: '件', quantity: 10, unitPrice: 5 }],
    });
    const purchase = created.purchaseOrders[0]; documentIds.add(purchase.id);
    await purchases.submit({ purchaseOrderId: purchase.id, currentStatus: 'draft', operatorId: 4 });
    await purchases.approve({ purchaseOrderId: purchase.id, currentStatus: 'pending_purchase_manager_approval', operatorId: 1 });
    const cancel = () => sales.cancel({ salesOrderId: order.id, currentStatus: 'purchasing', cancelReason: '客户调整计划', operatorId: 1 });
    const ship = () => shipments.create({ salesOrderId: order.id, purchaseOrderId: purchase.id,
      shippedQty: 10, accumulatedQty: 10, remainingQty: 0, shippedAt: '2026-09-28', shippingCode: 'BATCH2-CONCURRENT',
      createdBy: 4, purchaseOrderCurrentStatus: 'purchasing', currentBatchCount: 0,
      items: [{ purchaseLineNo: 1, sourceSalesItemId: 1, productId: 501, sku: 'SKU-LED-001', productName: '灯带', unit: '件', shippedQty: 10, purchaseQty: 10 }],
    });
    const outcomes = await Promise.allSettled(shipmentFirst ? [ship(), cancel()] : [cancel(), ship()]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    const savedSale = await sales.getDetail(order.id);
    const savedPurchase = await purchases.getDetail(purchase.id);
    const batches = (await prisma.businessDocument.findMany({ where: { bizType: 'shipment_batch' } }))
      .filter(batch => Number((batch.payload as any).salesOrderId) === order.id);
    if (savedSale.status === 'void') {
      expect(savedPurchase.status).toBe('void'); expect(batches).toHaveLength(0);
    } else {
      expect(savedPurchase.status).toBe('shipped'); expect(batches).toHaveLength(1);
    }
  });
});
