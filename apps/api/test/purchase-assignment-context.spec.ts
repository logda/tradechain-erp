import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SalesOrderService, type SalesOrderRecord } from '../src/sales-order/sales-order.service';
import { resolveSalesOrderStore } from '../src/sales-order/sales-order.store';
import type { PrismaService } from '../src/storage/prisma.service';

describe('purchase assignment context', () => {
  let dataDir: string;
  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-assignment-context-'));
    process.env.ERP_DATA_DIR = dataDir;
    delete process.env.ERP_STORAGE_MODE;
  });
  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    delete process.env.ERP_STORAGE_MODE;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it.each(['runtime', 'prisma'])('returns the pending order context without sales prices or unrelated records in %s', async (mode) => {
    const sale = {
      id: 901, salesNo: 'S901', title: 'Fan order', status: 'pending_purchase_assignment',
      currentVersionNo: 1, purchaseAggregateStatus: 'not_started', shipmentAggregateStatus: 'not_started',
      receiptSendStatus: 'pending', afterSalesEndStatus: 'not_started', financeStatus: 'pending', customerId: 11,
      sourceMode: 'from_quote', sourceQuoteOrderId: 701, sourceQuoteVersionNo: 2, sourceQuoteNo: 'BJ701', sourceInquiryId: 801,
      salesUserId: 2001, customerName: 'Customer A', customerFullName: 'Customer A Limited',
      customerOrderNo: 'PO-A', orderingUnit: 'Customer branch', storeName: 'Online',
      orderDate: '2026-09-28', estimatedDeliveryDate: '2026-10-10', shipTo: 'Shanghai',
      salesOrderRemark: 'Keep the original packaging',
      salesOrderAttachments: [{ fileName: 'spec.pdf', mimeType: 'application/pdf', size: 20, url: '/files/spec.pdf' }],
      purchaseOwnerId: 2002, purchaseOwnerName: 'Leo', createdBy: 2001, createdAt: '2026-09-28T00:00:00.000Z',
      versionHistory: [], receiptStatus: 'deposit_received',
      items: [{ lineNo: 1, productId: 501, sku: 'FAN-A', productName: 'Fan A', unit: '个', quantity: 12,
        packageQuantity: 2, unitsPerPackage: 6, totalQuantity: 12, salePrice: 99, amount: 1188,
        factoryPicUrls: ['/files/fan.png'], confirmedSupplierName: 'Factory A' }],
    } as SalesOrderRecord;
    // This runtime record must never leak into a Prisma query.
    const unrelated = { ...sale, id: 902, salesNo: 'S902', customerName: 'Customer B', status: 'draft' };
    resolveSalesOrderStore().upsertSalesOrder(mode === 'runtime' ? sale : { ...sale, id: 903, salesNo: 'RUNTIME-ONLY' });
    resolveSalesOrderStore().upsertSalesOrder(unrelated);
    const findMany = jest.fn().mockResolvedValue([{ id: 901n, bizType: 'sales_order', docNo: 'S901', status: sale.status,
      createdAt: new Date(sale.createdAt), payload: sale }]);
    process.env.ERP_STORAGE_MODE = mode;
    const service = new SalesOrderService(mode === 'prisma' ? { businessDocument: { findMany } } as unknown as PrismaService : undefined);
    const assignments = await service.listPendingPurchaseAssignments();
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      id: 901, salesNo: 'S901', customerName: 'Customer A', customerFullName: 'Customer A Limited',
      customerOrderNo: 'PO-A', orderingUnit: 'Customer branch', storeName: 'Online',
      orderDate: '2026-09-28', estimatedDeliveryDate: '2026-10-10', shipTo: 'Shanghai',
      salesOrderRemark: sale.salesOrderRemark, salesOrderAttachments: sale.salesOrderAttachments,
      salesUserId: 2001, sourceQuoteNo: 'BJ701', sourceQuoteVersionNo: 2, sourceInquiryId: 801,
      items: [{ lineNo: 1, sku: 'FAN-A', productName: 'Fan A', quantity: 12,
        packageQuantity: 2, unitsPerPackage: 6, totalQuantity: 12, unit: '个', factoryPicUrls: ['/files/fan.png'] }],
    });
    expect(assignments[0]).not.toHaveProperty('receiptStatus');
    const products = (assignments[0] as unknown as { items: unknown[] }).items;
    expect(products[0]).not.toHaveProperty('salePrice');
    expect(products[0]).not.toHaveProperty('amount');
    if (mode === 'prisma') expect(findMany).toHaveBeenCalledWith({ where: { bizType: 'sales_order', status: 'pending_purchase_assignment' } });
    else expect(findMany).not.toHaveBeenCalled();
  });
});
