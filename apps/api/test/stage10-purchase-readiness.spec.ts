import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';

describe('stage 10 purchase submission and delivery', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-stage10-'));
    process.env.ERP_DATA_DIR = dataDir;
    delete process.env.ERP_STORAGE_MODE;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    delete process.env.ERP_STORAGE_MODE;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('defaults a new title from sales number, ordered products and supplier, then saves the purchaser edit on submit', async () => {
    const service = new PurchaseOrderService();
    const created = await service.createFromSalesOrder({
      salesOrderId: 901,
      salesOrderNo: 'S2609250901',
      createdBy: 2002,
      ownerName: 'Leo',
      items: [
        { salesItemId: 1, supplierId: 3001, supplierName: '星河供应', productId: 501, productName: '风扇', quantity: 2, unitPrice: 10 },
        { salesItemId: 2, supplierId: 3001, supplierName: '星河供应', productId: 501, productName: '台灯', quantity: 3, unitPrice: 12 },
      ],
    });
    const id = created.purchaseOrders[0].id;
    expect(created.purchaseOrders).toHaveLength(1);
    expect((created.purchaseOrders[0] as { title?: string }).title).toBe('S2609250901-风扇、台灯-星河供应');

    await service.submit({ purchaseOrderId: id, currentStatus: 'draft', title: '客户项目首批采购', session: { role: 'purchase', user: 'Leo' } } as Parameters<PurchaseOrderService['submit']>[0]);
    const reloaded = new PurchaseOrderService();
    expect((await reloaded.getDetail(id) as { title?: string }).title).toBe('客户项目首批采购');
    expect((await reloaded.list({ page: 1, pageSize: 20 })).items.find((item) => item.docNo === created.purchaseOrders[0].purchaseNo)?.title).toBe('客户项目首批采购');
    await expect(service.submit({ purchaseOrderId: id, currentStatus: 'draft', title: '重复提交' } as Parameters<PurchaseOrderService['submit']>[0])).rejects.toThrow('状态已变更');
  });

  it('clips only the product-name portion of a long default title', async () => {
    const service = new PurchaseOrderService();
    const created = await service.createFromSalesOrder({
      salesOrderId: 902, salesOrderNo: 'S2609250902', createdBy: 2002, ownerName: 'Leo',
      items: [{ salesItemId: 1, supplierId: 3001, supplierName: '星河供应', productId: 501,
        productName: '带遥控器的超长产品名称及客户包装要求和其他说明内容', quantity: 1, unitPrice: 10 }],
    });
    expect((created.purchaseOrders[0] as { title?: string }).title).toMatch(/^S2609250902-.*等-星河供应$/);
    expect((created.purchaseOrders[0] as { title?: string }).title).not.toContain('其他说明内容');
  });

  it('keeps the generated title aligned when the draft supplier changes', async () => {
    const service = new PurchaseOrderService();
    const created = await service.createFromSalesOrder({
      salesOrderId: 904, salesOrderNo: 'S2609250904', createdBy: 2002, ownerName: 'Leo',
      items: [{ salesItemId: 1, supplierId: 3001, supplierName: '原供应商',
        productId: 501, productName: '风扇', quantity: 2, unitPrice: 10 }],
    });
    const purchaseOrderId = created.purchaseOrders[0].id;
    await service.saveDraft({ purchaseOrderId, currentStatus: 'draft', ownerName: 'Leo',
      supplierId: 3002, supplierName: '新供应商',
      session: { role: 'purchase', user: 'Leo' } });
    expect((await service.getDetail(purchaseOrderId)).title).toBe('S2609250904-风扇-新供应商');
  });

  it('allows only the assigned purchaser to change ETA after approval and before shipment', async () => {
    const service = new PurchaseOrderService();
    const created = await service.createFromSalesOrder({
      salesOrderId: 903, salesOrderNo: 'S2609250903', createdBy: 2002, ownerName: 'Leo',
      factoryEstimatedDeliveryDate: '2026-09-29',
      items: [{ salesItemId: 1, supplierId: 3001, productId: 501, quantity: 2, unitPrice: 10,
        factoryEstimatedDeliveryDate: '2026-09-29' }],
    });
    const purchaseOrderId = created.purchaseOrders[0].id;
    const changeEta = (input: { date: string; currentStatus: string; user: string }) =>
      (service as unknown as { updateFactoryEstimatedDeliveryDate: (value: object) => Promise<unknown> })
        .updateFactoryEstimatedDeliveryDate({
          purchaseOrderId, factoryEstimatedDeliveryDate: input.date,
          currentStatus: input.currentStatus, session: { role: 'purchase', user: input.user },
        });

    await expect(changeEta({ date: '2026-10-01', currentStatus: 'draft', user: 'Leo' }))
      .rejects.toThrow('审批通过');
    await service.submit({ purchaseOrderId, currentStatus: 'draft', session: { role: 'purchase', user: 'Leo' } });
    await service.approve({ purchaseOrderId, currentStatus: 'pending_purchase_manager_approval' });
    await expect(changeEta({ date: '2026-10-01', currentStatus: 'purchasing', user: 'Nina' }))
      .rejects.toThrow('指定采购负责人');
    await expect(changeEta({ date: '2026-02-30', currentStatus: 'purchasing', user: 'Leo' }))
      .rejects.toThrow('日期');
    await changeEta({ date: '2026-10-01', currentStatus: 'purchasing', user: 'Leo' });
    const detail = await new PurchaseOrderService().getDetail(purchaseOrderId);
    expect(detail.factoryEstimatedDeliveryDate).toBe('2026-10-01');
    expect(detail.items[0].factoryEstimatedDeliveryDate).toBe('2026-10-01');
    await expect(changeEta({ date: '2026-10-01', currentStatus: 'purchasing', user: 'Leo' }))
      .rejects.toThrow('相同');
    await service.syncShipmentFulfillmentStatus({ purchaseOrderId, status: 'partial_shipped', operatorId: 2002 });
    await expect(changeEta({ date: '2026-10-02', currentStatus: 'partial_shipped', user: 'Leo' }))
      .rejects.toThrow('发货前');
  });
});
