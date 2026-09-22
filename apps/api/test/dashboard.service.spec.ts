import { BossDashboardService } from '../src/dashboard/dashboard.service';
import { AfterSalesService } from '../src/after-sales/after-sales.service';
import { QuoteService } from '../src/quote/quote.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('BossDashboardService', () => {
  it('returns zeroed boss dashboard aggregates when there are no records', async () => {
    const service = new BossDashboardService();

    const result = await service.getSummary();

    expect(result.workflowAlerts).toEqual([
      expect.objectContaining({ key: 'quotes_pending_boss_confirm', count: 0 }),
      expect.objectContaining({ key: 'shipment_exceptions', count: 0 }),
      expect.objectContaining({ key: 'after_sales_pending_close', count: 0 }),
    ]);
    expect(result.salesOverview).toMatchObject({
      totalOrders: 0,
      pendingApproval: 0,
      inProduction: 0,
      partiallyShipped: 0,
      fullyShipped: 0,
    });
    expect(result.purchaseOverview).toMatchObject({
      totalOrders: 0,
      pendingApproval: 0,
      purchasing: 0,
      partiallyReceived: 0,
      completed: 0,
    });
    expect(result.afterSalesOverview).toMatchObject({
      openCases: 0,
      pendingApproval: 0,
      processing: 0,
      financeReviewing: 0,
      closedThisMonth: 0,
    });
    expect(result.financeOverview).toMatchObject({
      pendingConfirmation: 0,
      confirmedThisMonth: 0,
      prepaidDeducted: 0,
    });
  });

  it('adds runtime workflow records to boss dashboard alerts and overviews', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-dashboard-'));
    process.env.ERP_DATA_DIR = runtimeDir;

    try {
      const quoteService = new QuoteService();
      const salesService = new SalesOrderService();
      const shipmentService = new ShipmentBatchService();
      const afterSalesService = new AfterSalesService();

      await quoteService.create({
        customerId: 1001,
        salesUserId: 2001,
        sourceCode: 'expo',
        requirements: 'Runtime dashboard quote',
        items: [
          {
            productId: 501,
            sku: 'SKU-LED-001',
            productName: '智能 LED 灯带',
            unit: 'set',
            quantity: 10,
            salePrice: 20,
          },
        ],
      });

      const salesOrder = await salesService.create({
        customerName: 'Acme Trading',
        title: 'Acme dashboard order',
        salesUserId: 2001,
        createdBy: 2001,
      });
      await salesService.submit({
        salesOrderId: salesOrder.id,
        currentStatus: 'draft',
      });

      const shipment = await shipmentService.create({
        salesOrderId: salesOrder.id,
        purchaseOrderId: 21,
        shippedQty: 10,
        accumulatedQty: 10,
        remainingQty: 0,
        shippedAt: '2026-07-12T12:00:00.000Z',
        shippingCode: 'SHIP-TEST-AUTO-001',
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'purchasing',
        currentBatchCount: 0,
      });
      await shipmentService.markException({
        shipmentBatchId: shipment.id,
        currentStatus: 'shipped',
        reason: '包装破损',
      });

      await afterSalesService.create({
        salesOrderId: salesOrder.id,
        purchaseOrderId: 21,
        shipmentBatchId: shipment.id,
        type: 'customer_complaint',
        issueDescription: 'Runtime dashboard case',
        createdBy: 2001,
      });

      const result = await new BossDashboardService().getSummary();

      expect(result.workflowAlerts).toEqual([
        expect.objectContaining({ key: 'quotes_pending_boss_confirm', count: 1 }),
        expect.objectContaining({ key: 'shipment_exceptions', count: 1 }),
        expect.objectContaining({ key: 'after_sales_pending_close', count: 1 }),
      ]);
      expect(result.salesOverview).toMatchObject({
        totalOrders: 1,
        pendingApproval: 1,
        inProduction: 0,
        partiallyShipped: 0,
        fullyShipped: 0,
      });
      expect(result.afterSalesOverview).toMatchObject({
        openCases: 1,
        pendingApproval: 0,
        processing: 0,
        financeReviewing: 0,
        closedThisMonth: 0,
      });
      expect(result.financeOverview.pendingConfirmation).toBe(1);
    } finally {
      delete process.env.ERP_DATA_DIR;
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });
});
