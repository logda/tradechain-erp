import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UserManagementService } from '../src/user-management/user-management.service';
import { UserManagementRuntimeStore } from '../src/user-management/user-management.store';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';

describe('purchase owner identity', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'erp-purchase-identity-')); process.env.ERP_DATA_DIR = dir; });
  afterEach(() => { delete process.env.ERP_DATA_DIR; rmSync(dir, { recursive: true, force: true }); });
  it('selects same-name employees by ID and retains source ownership after rename', async () => {
    const users = new UserManagementService();
    const first = await users.create({ username: 'first', realName: '采购员', password: 'secret', roleCode: 'purchase', createdBy: 'admin' });
    const second = await users.create({ username: 'second', realName: '采购员', password: 'secret', roleCode: 'purchase', createdBy: 'admin' });
    const source = { syncOperationalAggregates: jest.fn(), getDetail: jest.fn().mockResolvedValue({ id: 88, salesNo: 'S2609280088', status: 'purchasing', purchaseOwnerId: second.id, purchaseOwnerName: '采购员' }) };
    const service = new PurchaseOrderService(undefined, source as any, users);
    const items = [{ salesItemId: 1, supplierId: 3001, supplierName: 'Factory', productId: 1, sku: 'SKU', productName: 'Product', quantity: 10, unitPrice: 12 }];
    await expect(service.createFromSalesOrder({ salesOrderId: 88, ownerId: first.id, createdBy: first.id, session: { role: 'purchase', user: '采购员', userId: first.id }, items })).rejects.toThrow('采购负责人必须与来源销售单一致');
    const store = (users as any).store as UserManagementRuntimeStore;
    store.saveUsers(store.listUsers().map(user => user.id === second.id ? { ...user, realName: '新采购名' } : user));
    const result = await service.createFromSalesOrder({ salesOrderId: 88, ownerId: second.id, ownerName: '采购员', createdBy: second.id, session: { role: 'purchase', user: '新采购名', userId: second.id }, items });
    expect(result.purchaseOrders[0]).toMatchObject({ ownerId: second.id, ownerName: '新采购名' });
    expect((await service.list({}, { role: 'purchase', user: '采购员', userId: first.id })).items).toEqual([]);
  });

  it('preserves the assigned owner after rename and records the real submit and reject actors', async () => {
    const users = new UserManagementService();
    const owner = await users.create({ username: 'newpurchaser', realName: 'Original name', password: 'secret', roleCode: 'purchase', createdBy: 'admin' });
    const service = new PurchaseOrderService(undefined, undefined, users);
    const created = await service.createFromSalesOrder({ salesOrderId: 88, createdBy: 1, ownerName: 'Original name', session: { role: 'admin', user: 'Admin', userId: 1 }, items: [{ salesItemId: 1, supplierId: 3001, supplierName: 'Factory', productId: 1, sku: 'SKU', productName: 'Product', quantity: 10, unitPrice: 12 }] });
    const purchase = created.purchaseOrders[0];
    expect(purchase.ownerId).toBe(owner.id);
    const store = (users as any).store as UserManagementRuntimeStore;
    store.saveUsers(store.listUsers().map(user => user.id === owner.id ? { ...user, realName: 'Renamed purchaser' } : user));
    const session = { role: 'purchase' as const, user: 'Renamed purchaser', userId: owner.id };
    expect((await service.list({}, session)).items.map(item => item.ownerId)).toContain(owner.id);
    await service.saveDraft({ purchaseOrderId: purchase.id, currentStatus: purchase.status, ownerName: 'Original name', session });
    await service.submit({ purchaseOrderId: purchase.id, currentStatus: purchase.status, session });
    await (new PurchaseOrderController(service).reject as any)(purchase.id, { currentStatus: 'pending_purchase_manager_approval', rejectionReason: '请核对采购价' }, '2');
    const audit = await service.listAuditLogs();
    expect(audit.items.find(item => item.operationType === 'submit_purchase_order')?.operatorId).toBe(owner.id);
    expect(audit.items.find(item => item.operationType === 'reject_purchase_order')?.operatorId).toBe(2);
    expect((await service.getDetail(purchase.id, session)).ownerId).toBe(owner.id);
  });
});
