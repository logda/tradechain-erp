import { ReportService } from '../src/report/report.service';
import { AfterSalesService } from '../src/after-sales/after-sales.service';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ReportService', () => {
  it('returns zeroed sales summaries when there are no records', async () => {
    const service = new ReportService();

    const salesSummary = await service.getSalesSummary();
    const grossProfit = await service.getGrossProfitSummary();
    const periodSummary = await service.getPeriodSummary();

    expect(salesSummary.totals).toMatchObject({
      salesOrderCount: 0,
      submittedAmount: 0,
      shippedAmount: 0,
    });
    expect(salesSummary.totals).not.toHaveProperty('receivedAmount');
    expect(salesSummary.shipmentBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'not_shipped', count: 0 }),
        expect.objectContaining({ status: 'partially_shipped', count: 0 }),
        expect.objectContaining({ status: 'fully_shipped', count: 0 }),
      ]),
    );
    expect(salesSummary.afterSalesOverview).toMatchObject({
      openCases: 0,
      pendingApproval: 0,
      processing: 0,
      financeReviewing: 0,
      closedThisMonth: 0,
    });
    expect(grossProfit.totalRevenue).toBe(0);
    expect(grossProfit.totalProcurementCost).toBe(0);
    expect(grossProfit.totalAfterSalesCost).toBe(0);
    expect(grossProfit.grossProfit).toBe(
      grossProfit.totalRevenue -
        grossProfit.totalProcurementCost -
        grossProfit.totalAfterSalesCost,
    );
    expect(periodSummary).toMatchObject({
      salesOrdersCreated: 0,
      purchaseOrdersCreated: 0,
      shipmentBatchesCreated: 0,
      afterSalesCreated: 0,
      closedOrders: 0,
      reopenedApprovals: 0,
    });
  });

  it('adds runtime sales, purchase, shipment, and after-sales records into period rollups', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-report-'));
    process.env.ERP_DATA_DIR = runtimeDir;

    try {
      const salesService = new SalesOrderService();
      const purchaseService = new PurchaseOrderService();
      const shipmentService = new ShipmentBatchService();
      const afterSalesService = new AfterSalesService();

      const salesOrder = await salesService.create({
        customerName: 'Acme Trading',
        title: 'Acme report rollup order',
        salesUserId: 2001,
        createdBy: 2001,
      });
      expect(salesOrder.items).toEqual([]);

      await purchaseService.createFromSalesOrder({
        salesOrderId: salesOrder.id,
        createdBy: 2002,
        items: [
          {
            salesItemId: 1,
            supplierId: 3001,
            productId: 501,
            quantity: 10,
            unitPrice: 12.5,
          },
        ],
      });

      await shipmentService.create({
        salesOrderId: salesOrder.id,
        purchaseOrderId: 100,
        shippedQty: 10,
        accumulatedQty: 10,
        remainingQty: 0,
        shippedAt: '2026-07-12T12:00:00.000Z',
        shippingCode: 'SHIP-TEST-AUTO-001',
        createdBy: 2002,
        purchaseOrderCurrentStatus: 'purchasing',
        currentBatchCount: 0,
      });

      await afterSalesService.create({
        salesOrderId: salesOrder.id,
        purchaseOrderId: 100,
        shipmentBatchId: 100,
        type: 'customer_complaint',
        issueDescription: 'Runtime report case',
        createdBy: 2001,
      });

      const runtimeReportService = new ReportService();
      const salesSummary = await runtimeReportService.getSalesSummary();
      const periodSummary = await runtimeReportService.getPeriodSummary();

      expect(salesSummary).toMatchObject({
        totals: {
          salesOrderCount: 1,
          submittedAmount: 0,
          shippedAmount: 0,
        },
        afterSalesOverview: {
          openCases: 1,
          pendingApproval: 0,
          processing: 0,
          financeReviewing: 0,
          closedThisMonth: 0,
        },
      });
      expect(periodSummary).toMatchObject({
        salesOrdersCreated: 1,
        purchaseOrdersCreated: 1,
        shipmentBatchesCreated: 1,
        afterSalesCreated: 1,
        closedOrders: 0,
        reopenedApprovals: 0,
      });
    } finally {
      delete process.env.ERP_DATA_DIR;
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });
});
