import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('SalesOrderService persistence', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-sales-order-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('persists direct sales order status changes across service instances', async () => {
    const firstService = new SalesOrderService();
    const created = await firstService.create({
      customerName: 'Acme Trading',
      title: 'Acme 追加补货',
      salesUserId: 2001,
      createdBy: 2001,
    });

    await firstService.submit({
      salesOrderId: created.id,
      currentStatus: 'draft',
    });

    const secondService = new SalesOrderService();
    const detail = await secondService.getDetail(created.id);

    expect(detail).toMatchObject({
      id: created.id,
      salesNo: created.salesNo,
      status: 'pending_sales_manager_approval',
      customerName: 'Acme Trading',
      sourceMode: 'direct',
    });
  });
});
