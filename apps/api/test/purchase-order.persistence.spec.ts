import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';

describe('PurchaseOrderService persistence', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-purchase-order-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('persists split purchase orders and approval status across service instances', async () => {
    const firstService = new PurchaseOrderService();
    const created = await firstService.createFromSalesOrder({
      salesOrderId: 88,
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
    const purchaseOrderId = created.purchaseOrders[0].id;

    await firstService.submit({
      purchaseOrderId,
      currentStatus: 'draft',
    });
    await firstService.approve({
      purchaseOrderId,
      currentStatus: 'pending_purchase_manager_approval',
    });

    const secondService = new PurchaseOrderService();
    const detail = await secondService.getDetail(purchaseOrderId);

    expect(detail).toMatchObject({
      id: purchaseOrderId,
      status: 'purchasing',
      sourceSalesOrderId: 88,
      supplierId: 3001,
    });
  });
});
