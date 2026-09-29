import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ReportService } from '../src/report/report.service';
import { SalesOrderService, type SalesOrderRecord } from '../src/sales-order/sales-order.service';
import { resolveSalesOrderStore } from '../src/sales-order/sales-order.store';
import { resolveShipmentBatchStore } from '../src/shipment-batch/shipment-batch.store';
import type { CreatedShipmentBatchRecord } from '../src/shipment-batch/shipment-batch.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe.each(['runtime', 'prisma'])('sales amounts in %s', (mode) => {
  let dir: string;
  let order: SalesOrderRecord;
  let shipments: CreatedShipmentBatchRecord[];
  const originalMode = process.env.ERP_STORAGE_MODE;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'erp-amounts-'));
    process.env.ERP_DATA_DIR = dir;
    process.env.ERP_STORAGE_MODE = 'runtime';
    const created = await new SalesOrderService().create({
      customerName: '金额核对客户', title: '金额核对', salesUserId: 2001, createdBy: 2001,
      items: [
        { lineNo: 1, productId: 501, sku: 'A', productName: 'A', unit: '件', quantity: 10, salePrice: 12.35, amount: 123.5 },
        { lineNo: 2, productId: 502, sku: 'B', productName: 'B', unit: '件', quantity: 5, salePrice: 20, amount: 100 },
      ],
    });
    order = resolveSalesOrderStore().getSalesOrder(created.id)!;
    shipments = [];
    process.env.ERP_STORAGE_MODE = mode;
  });
  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    if (originalMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = originalMode;
    rmSync(dir, { recursive: true, force: true });
  });

  function report() {
    resolveSalesOrderStore().upsertSalesOrder(order);
    shipments.forEach((batch) => resolveShipmentBatchStore().upsertShipmentBatch(batch));
    const prisma = { businessDocument: { findMany: async ({ where }: { where: { bizType: string } }) =>
      (where.bizType === 'sales_order' ? [order] : where.bizType === 'shipment_batch' ? shipments : [])
        .map((payload) => ({ id: BigInt(payload.id), ownerUserId: 2001n, payload })) } } as unknown as PrismaService;
    return new ReportService(prisma);
  }

  function batch(id: number, status: string, quantity: number, salesLine = 1): CreatedShipmentBatchRecord {
    return { id, batchNo: `SH-${id}`, status, salesOrderId: order.id, purchaseOrderId: 501,
      shippedQty: quantity, accumulatedQty: quantity, remainingQty: 10 - quantity,
      shippedAt: '2026-09-28', createdAt: '2026-09-28', createdBy: 2002,
      receiptSendStatus: 'pending', supplierName: '实际供应商', salesOrderNo: order.salesNo,
      purchaseOrderNo: 'PO-501', title: '批次', purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0, salesOrderLocked: true, hasException: status === 'exception',
      items: [{ lineNo: 1, purchaseLineNo: 1, sourceSalesItemId: salesLine,
        productId: salesLine === 1 ? 501 : 502, sku: 'A', productName: 'A', unit: '件', shippedQty: quantity, purchaseQty: 10 }] };
  }

  it('counts submission only at valid approval states and re-evaluates edited amounts once', async () => {
    const service = report();
    for (const [status, expected] of [
      ['draft', 0], ['pending_sales_manager_approval', 223.5], ['rejected', 0],
      ['pending_purchase_assignment', 223.5], ['purchasing', 223.5], ['closed', 223.5],
      ['partial_shipped', 223.5], ['shipped', 223.5], ['partial_to_forwarder', 223.5],
      ['to_forwarder', 223.5], ['forwarder_shipped', 223.5], ['arrived', 223.5],
      ['void', 0],
    ] as const) {
      order.status = status;
      report();
      expect((await service.getSalesSummary()).totals.submittedAmount).toBe(expected);
    }
    order.status = 'pending_sales_manager_approval';
    order.items![0] = { ...order.items![0], salePrice: 15, amount: 150 };
    report();
    expect((await service.getSalesSummary()).totals.submittedAmount).toBe(250);
    expect((await service.getSalesSummary()).totals.submittedAmount).toBe(250);
  });

  it('counts each actual supplier shipment by sales line price before forwarder shipment', async () => {
    order.status = 'purchasing';
    shipments = [batch(1, 'shipped', 2), batch(2, 'to_forwarder', 3), batch(3, 'exception', 1, 2), batch(4, 'draft', 4)];
    const service = report();
    expect((await service.getSalesSummary()).totals.shippedAmount).toBe(81.75);
    shipments[0].status = 'arrived';
    report();
    expect((await service.getSalesSummary()).totals.shippedAmount).toBe(81.75);
    expect((await service.getSalesSummary()).totals.shippedAmount).toBe(81.75);
  });

  it('reports void sales amount as the entire order while retaining already shipped value', async () => {
    order.status = 'void';
    shipments = [batch(1, 'shipped', 2)];
    const result = await report().getSalesSummary();
    expect(result.totals).toMatchObject({ submittedAmount: 0, voidedAmount: 223.5, shippedAmount: 24.7 });
  });

  it('restricts shipment and void amounts to the visible account', async () => {
    order.status = 'void'; shipments = [batch(1, 'shipped', 2)];
    const result = await report().getSalesSummary({ role: 'sales', userId: 2002, user: 'Leo', dataScope: 'own_sales' });
    expect(result.totals).toMatchObject({ salesOrderCount: 0, submittedAmount: 0, voidedAmount: 0, shippedAmount: 0 });
  });

  it('keeps independent totals available without publishing a misleading shipment zero', async () => {
    order.status = 'purchasing';
    shipments = [batch(1, 'shipped', 2, 99)];
    const result = await report().getSalesSummary();
    expect(result.totals).toEqual({ salesOrderCount: 1, submittedAmount: 223.5, voidedAmount: 0, shippedAmount: null });
    expect(result).toHaveProperty('shippedAmountIssues', [{
      batchNo: 'SH-1', salesOrderId: order.id, salesOrderNo: order.salesNo,
      reason: '发货明细与销售明细无法对应，请核对来源和售价',
    }]);
  });

  it('reports all incomplete batches without presenting a known subtotal as the total', async () => {
    order.status = 'purchasing';
    shipments = [batch(1, 'shipped', 2), { ...batch(2, 'shipped', 3), items: [] }, batch(3, 'arrived', 1, 99)];
    const result = await report().getSalesSummary();
    expect(result.totals).toMatchObject({ salesOrderCount: 1, submittedAmount: 223.5, shippedAmount: null });
    expect(result).toHaveProperty('shippedAmountIssues', [
      { batchNo: 'SH-2', salesOrderId: order.id, salesOrderNo: order.salesNo, reason: '发货明细不完整，无法核对已发货金额' },
      { batchNo: 'SH-3', salesOrderId: order.id, salesOrderNo: order.salesNo, reason: '发货明细与销售明细无法对应，请核对来源和售价' },
    ]);
    expect(resolveShipmentBatchStore().getShipmentBatch(2)?.items).toEqual([]);
    shipments[1] = batch(2, 'shipped', 3);
    shipments[2] = batch(3, 'arrived', 1, 2);
    const recovered = await report().getSalesSummary();
    expect(recovered.totals.shippedAmount).toBe(81.75);
    expect(recovered).toHaveProperty('shippedAmountIssues', []);
  });

  it.each(['missing price', 'missing source', 'invalid quantity'] as const)('marks shipped value unknown for %s', async (invalid) => {
    shipments = [batch(1, 'shipped', 2)];
    if (invalid === 'missing price') delete (order.items![0] as { salePrice?: number }).salePrice;
    else if (invalid === 'missing source') {
      delete (order.items![0] as { lineNo?: number }).lineNo;
      delete (shipments[0].items[0] as { sourceSalesItemId?: number }).sourceSalesItemId;
    }
    else shipments[0].items[0].shippedQty = 0;
    const result = await report().getSalesSummary();
    expect(result.totals.shippedAmount).toBeNull();
    expect(result).toMatchObject({ shippedAmountIssues: [expect.anything()] });
  });

  it('does not expose incomplete shipment issues outside the account scope', async () => {
    shipments = [{ ...batch(1, 'shipped', 2), items: [] }];
    const result = await report().getSalesSummary({ role: 'sales', userId: 2002, dataScope: 'own_sales' });
    expect(result.totals).toEqual({ salesOrderCount: 0, submittedAmount: 0, voidedAmount: 0, shippedAmount: 0 });
    expect(result).toHaveProperty('shippedAmountIssues', []);
  });

  it('ignores unrelated shipments without importing their amounts or errors', async () => {
    order.status = 'purchasing';
    shipments = [batch(1, 'shipped', 2), { ...batch(2, 'shipped', 10, 99), salesOrderId: 999999 }];
    const result = await report().getSalesSummary({ role: 'sales', userId: 2001, user: 'Zoe', dataScope: 'own_sales' });
    expect(result.totals.shippedAmount).toBe(24.7);
  });

  it('keeps an unshipped order at zero despite a later aggregate status', async () => {
    order.status = 'closed'; order.shipmentAggregateStatus = 'arrived';
    expect((await report().getSalesSummary()).totals.shippedAmount).toBe(0);
  });
});
