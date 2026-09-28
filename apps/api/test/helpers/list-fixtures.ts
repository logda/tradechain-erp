import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inquiryListData } from '../../src/inquiry/inquiry-list.data';
import { resolveInquiryStore } from '../../src/inquiry/inquiry.store';
import { salesOrderListData } from '../../src/sales-order/sales-order-list.data';
import { resolveSalesOrderStore } from '../../src/sales-order/sales-order.store';
import { quoteListData } from '../../src/quote/quote-list.data';
import { resolveQuoteStore } from '../../src/quote/quote.store';
import { purchaseOrderListData } from '../../src/purchase-order/purchase-order-list.data';
import { resolvePurchaseOrderStore } from '../../src/purchase-order/purchase-order.store';
import { shipmentBatchListData } from '../../src/shipment-batch/shipment-batch-list.data';
import { resolveShipmentBatchStore } from '../../src/shipment-batch/shipment-batch.store';
import { afterSalesListData } from '../../src/after-sales/after-sales-list.data';
import { resolveAfterSalesStore } from '../../src/after-sales/after-sales.store';
import { sampleOrderListData } from '../../src/sample-order/sample-order-list.data';
import { resolveSampleOrderStore } from '../../src/sample-order/sample-order.store';
import { SampleOrderService } from '../../src/sample-order/sample-order.service';

type FixtureModule = 'sales' | 'quote' | 'purchase' | 'shipment' | 'after-sales' | 'sample' | 'inquiry';
const userIds: Record<string, number> = { Zoe: 2001, Leo: 2002, Mia: 2000, Ivy: 2010 };

// Old preview examples are explicit test inputs; business services never seed them.
export function seedInquiryFixtures() {
  inquiryListData.forEach((row) => resolveInquiryStore().upsertInquiry(row));
}

async function seedListFixtures(module: FixtureModule) {
  if (module === 'inquiry') return seedInquiryFixtures();
  if (module === 'sales') {
    const store = resolveSalesOrderStore();
    salesOrderListData.forEach((row, index) => store.upsertSalesOrder({
      ...row, id: index + 1, salesNo: row.docNo, salesUserId: userIds[row.ownerName ?? ''],
      createdBy: userIds[row.createdBy], customerName: row.counterpartyName ?? '',
      sourceMode: index === 1 ? 'direct' : 'from_quote', customerId: index === 1 ? 2 : 1,
      sourceQuoteOrderId: index + 1, sourceQuoteVersionNo: 1,
      sourceInquiryId: index === 0 ? 2 : undefined, currentVersionNo: 1,
      purchaseAggregateStatus: 'not_started', shipmentAggregateStatus: row.fulfillmentStatus,
      receiptSendStatus: 'pending', afterSalesEndStatus: row.hasAfterSales ? 'processing' : 'not_started',
      financeStatus: row.financeConfirmStatus, items: [], versionHistory: [],
    } as unknown as Parameters<typeof store.upsertSalesOrder>[0]));
  } else if (module === 'quote') {
    const store = resolveQuoteStore();
    quoteListData.forEach((row, index) => store.upsertQuote({
      ...row, id: index + 1, quoteNo: row.docNo, customerId: row.customerId ?? 2,
      salesUserId: userIds[row.createdBy], salesUserName: row.createdBy,
      sourceCode: row.sourceType, currentVersionNo: 1, productSource: 'existing',
      status: index === 0 ? 'pending_customer_feedback' : row.status,
      items: [], versions: [], createdAt: row.createdAt,
    } as unknown as Parameters<typeof store.upsertQuote>[0]));
  } else if (module === 'purchase') {
    const store = resolvePurchaseOrderStore();
    purchaseOrderListData.forEach((row, index) => store.upsertPurchaseOrder({
      ...row, id: index + 1, purchaseNo: row.docNo, createdBy: userIds[row.createdBy],
      sourceSalesOrderId: index + 1, supplierId: index === 1 ? 2 : 1,
      ownerId: userIds[row.ownerName ?? ''], currentVersionNo: 1,
      items: [], versionHistory: [],
    } as unknown as Parameters<typeof store.upsertPurchaseOrder>[0]));
  } else if (module === 'shipment') {
    const store = resolveShipmentBatchStore();
    shipmentBatchListData.forEach((row, index) => store.upsertShipmentBatch({
      ...row, id: index + 1, batchNo: row.docNo, salesOrderId: index + 1,
      purchaseOrderId: index + 1, createdBy: 2002, items: [], shippedQty: 0,
      remainingQty: 0, versionHistory: [],
    } as unknown as Parameters<typeof store.upsertShipmentBatch>[0]));
  } else if (module === 'after-sales') {
    const store = resolveAfterSalesStore();
    afterSalesListData.forEach((row, index) => store.upsertAfterSalesOrder({
      ...row, id: index + 1, afterSalesNo: row.docNo, salesOrderId: index + 1,
      purchaseOrderId: index + 1, shipmentBatchId: index + 1,
      createdBy: userIds[row.createdBy], ownerId: userIds[row.ownerName ?? ''],
      items: [], versionHistory: [],
    } as unknown as Parameters<typeof store.upsertAfterSalesOrder>[0]));
  } else {
    const store = resolveSampleOrderStore();
    const service = new SampleOrderService();
    for (let index = 0; index < sampleOrderListData.length; index += 1) {
      const row = sampleOrderListData[index];
      const detail = await service.getDetail(index + 1);
      store.upsertSampleOrder({ ...detail, sampleNo: row.docNo, title: row.title,
        currentStatus: row.status, ownerName: row.ownerName, quoteNo: row.quoteNo,
        isReplacement: row.isReplacement, isCancelled: row.isCancelled,
        createdAt: row.createdAt });
    }
  }
}

export function useListFixtures(module: FixtureModule) {
  let dir: string;
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'erp-explicit-fixtures-'));
    process.env.ERP_DATA_DIR = dir;
    delete process.env.ERP_STORAGE_MODE;
    await seedListFixtures(module);
  });
  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });
}
