import { AfterSalesService } from '../src/after-sales/after-sales.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('AfterSalesService', () => {
  it('creates an after-sales order tied to a sales order and optional shipment batch', async () => {
    const service = new AfterSalesService();

    const result = await service.create({
      salesOrderId: 9,
      purchaseOrderId: 21,
      shipmentBatchId: 3,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2001,
    });

    expect(result.status).toBe('pending_submit');
    expect(result.financeReviewStatus).toBe('pending');
  });

  it('returns the created after-sales detail for the new order id', async () => {
    const service = new AfterSalesService();

    const created = await service.create({
      salesOrderId: 9,
      purchaseOrderId: 21,
      shipmentBatchId: 3,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2001,
    });
    const detail = await service.getDetail(created.id);

    expect(detail.id).toBe(created.id);
    expect(detail.afterSalesNo).toBe(created.afterSalesNo);
    expect(detail.status).toBe(created.status);
  });

  it('keeps shipment item traceability when creating an after-sales order', async () => {
    const service = new AfterSalesService();

    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shipmentBatchId: 101,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2002,
      items: [
        {
          lineNo: 1,
          shipmentLineNo: 1,
          purchaseLineNo: 1,
          sourceSalesItemId: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          affectedQty: 40,
          shipmentQty: 40,
        },
      ],
    });
    const detail = await service.getDetail(created.id);

    expect(detail.items).toEqual([
      expect.objectContaining({
        lineNo: 1,
        shipmentLineNo: 1,
        purchaseLineNo: 1,
        sourceSalesItemId: 1,
        productId: 501,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        affectedQty: 40,
        shipmentQty: 40,
      }),
    ]);
  });

  it('moves an after-sales order through approval, processing, finish, and close', async () => {
    const service = new AfterSalesService();

    const submitted = await service.submit({
      afterSalesOrderId: 5,
      currentStatus: 'pending_submit',
    });
    const approved = await service.approve({
      afterSalesOrderId: 5,
      currentStatus: submitted.status,
    });
    const processing = await service.startProcessing({
      afterSalesOrderId: 5,
      currentStatus: approved.status,
    });
    const finished = await service.finish({
      afterSalesOrderId: 5,
      currentStatus: processing.status,
    });
    const closed = await service.close({
      afterSalesOrderId: 5,
      currentStatus: finished.status,
      financeReviewStatus: 'confirmed',
    });

    expect(submitted.status).toBe('pending_approval');
    expect(approved.status).toBe('processing');
    expect(processing.status).toBe('finance_reviewing');
    expect(finished.status).toBe('finished');
    expect(closed.status).toBe('closed');
  });

  it('rejects close when finance review is not confirmed', async () => {
    const service = new AfterSalesService();

    await expect(
      service.close({
        afterSalesOrderId: 5,
        currentStatus: 'finished',
        financeReviewStatus: 'pending',
      }),
    ).rejects.toThrow('Finance review must be confirmed before closing after sales');
  });

  it('persists created after-sales orders into list and detail views', async () => {
    const service = new AfterSalesService();

    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shipmentBatchId: 101,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2002,
    });

    const listed = await service.list({ page: 1, pageSize: 20 });
    const detail = await service.getDetail(created.id);

    expect(listed.items.map((item) => item.docNo)).toEqual(
      expect.arrayContaining([created.afterSalesNo]),
    );
    expect(detail.afterSalesNo).toBe(created.afterSalesNo);
    expect(detail.status).toBe('pending_submit');
  });

  it('uses selected customer and supplier names from master data when provided', async () => {
    const service = new AfterSalesService();

    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shipmentBatchId: 101,
      customerName: 'Global Partner Ltd.',
      supplierName: 'Bravo Industrial',
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2002,
    });

    const listed = await service.list({ page: 1, pageSize: 20 });
    const item = listed.items.find((entry) => entry.docNo === created.afterSalesNo);

    expect(item).toMatchObject({
      customerName: 'Global Partner Ltd.',
      supplierName: 'Bravo Industrial',
    });
  });

  it('persists after-sales lifecycle through finance confirmation and close', async () => {
    const service = new AfterSalesService();

    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shipmentBatchId: 101,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2002,
    });

    await service.submit({
      afterSalesOrderId: created.id,
      currentStatus: 'pending_submit',
    });
    await service.approve({
      afterSalesOrderId: created.id,
      currentStatus: 'pending_approval',
    });
    await service.startProcessing({
      afterSalesOrderId: created.id,
      currentStatus: 'processing',
    });
    await service.confirmFinance({
      afterSalesOrderId: created.id,
      currentStatus: 'finance_reviewing',
      financeReviewStatus: 'pending',
    });
    await service.finish({
      afterSalesOrderId: created.id,
      currentStatus: 'finance_reviewing',
    });
    await service.close({
      afterSalesOrderId: created.id,
      currentStatus: 'finished',
      financeReviewStatus: 'confirmed',
    });

    const detail = await service.getDetail(created.id);

    expect(detail.financeReviewStatus).toBe('confirmed');
    expect(detail.status).toBe('closed');
  });

  it('syncs finance confirmation and close status back to the source sales order', async () => {
    const salesOrderService = new SalesOrderService();
    const salesOrder = await salesOrderService.create({
      customerName: 'Acme Trading',
      title: 'Acme 售后闭环联动测试',
      salesUserId: 2001,
      createdBy: 2001,
    });
    const service = new AfterSalesService();
    (service as unknown as { salesOrderService?: SalesOrderService }).salesOrderService =
      salesOrderService;

    const created = await service.create({
      salesOrderId: salesOrder.id,
      purchaseOrderId: 21,
      shipmentBatchId: 101,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2002,
    });

    await service.submit({
      afterSalesOrderId: created.id,
      currentStatus: 'pending_submit',
    });
    await service.approve({
      afterSalesOrderId: created.id,
      currentStatus: 'pending_approval',
    });
    await service.startProcessing({
      afterSalesOrderId: created.id,
      currentStatus: 'processing',
    });
    await service.confirmFinance({
      afterSalesOrderId: created.id,
      currentStatus: 'finance_reviewing',
      financeReviewStatus: 'pending',
    });

    let detail = await salesOrderService.getDetail(salesOrder.id);
    expect(detail.financeStatus).toBe('confirmed');
    expect(detail.afterSalesEndStatus).toBe('finance_reviewing');

    await service.finish({
      afterSalesOrderId: created.id,
      currentStatus: 'finance_reviewing',
    });
    await service.close({
      afterSalesOrderId: created.id,
      currentStatus: 'finished',
      financeReviewStatus: 'confirmed',
    });

    detail = await salesOrderService.getDetail(salesOrder.id);
    expect(detail.afterSalesEndStatus).toBe('closed');
  });
});
