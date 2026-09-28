import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AfterSalesController } from '../src/after-sales/after-sales.controller';
import { AfterSalesService } from '../src/after-sales/after-sales.service';

describe('AfterSalesService persistence', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-after-sales-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('records the authenticated submit and rejection actors rather than the original creator', async () => {
    const service = new AfterSalesService();
    const order = await service.create({ salesOrderId: 88, purchaseOrderId: 21, shipmentBatchId: 100, type: 'customer_complaint', issueDescription: 'Damage', createdBy: 57 });
    const controller = new AfterSalesController(service);
    await (controller.submit as any)(order.id, { currentStatus: 'pending_submit' }, '57');
    await (controller.reject as any)(order.id, { currentStatus: 'pending_approval', rejectionReason: '请补充退款明细' }, '1');
    const logs = await service.listAuditLogs();
    expect(logs.items.find(item => item.operationType === 'submit_after_sales')?.operatorId).toBe(57);
    expect(logs.items.find(item => item.operationType === 'reject_after_sales')?.operatorId).toBe(1);
    expect((await service.list({})).items.find(item => item.docNo === order.afterSalesNo)?.createdById).toBe(57);
  });

  it('persists after-sales lifecycle and finance confirmation across service instances', async () => {
    const firstService = new AfterSalesService();
    const created = await firstService.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shipmentBatchId: 100,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2001,
    });

    await firstService.submit({
      afterSalesOrderId: created.id,
      currentStatus: 'pending_submit',
    });
    await firstService.approve({
      afterSalesOrderId: created.id,
      currentStatus: 'pending_approval',
    });
    await firstService.startProcessing({
      afterSalesOrderId: created.id,
      currentStatus: 'processing',
    });
    await firstService.confirmFinance({
      afterSalesOrderId: created.id,
      currentStatus: 'finance_reviewing',
      financeReviewStatus: 'pending',
    });
    await firstService.finish({
      afterSalesOrderId: created.id,
      currentStatus: 'finance_reviewing',
    });
    await firstService.close({
      afterSalesOrderId: created.id,
      currentStatus: 'finished',
      financeReviewStatus: 'confirmed',
    });

    const secondService = new AfterSalesService();
    const detail = await secondService.getDetail(created.id);

    expect(detail).toMatchObject({
      id: created.id,
      afterSalesNo: created.afterSalesNo,
      status: 'closed',
      financeReviewStatus: 'confirmed',
      salesOrderId: 88,
      purchaseOrderId: 21,
      shipmentBatchId: 100,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
    });
  });
});
