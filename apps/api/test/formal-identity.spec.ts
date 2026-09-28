import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { filterVisibleFormalItems, matchesFormalUser, readFormalSession } from '../src/auth/formal-session';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { QuoteService } from '../src/quote/quote.service';
import { UserManagementService } from '../src/user-management/user-management.service';
import { UserManagementRuntimeStore } from '../src/user-management/user-management.store';

describe('stable formal identity', () => {
  it('uses IDs after a rename and refuses matching names owned by a different employee', () => {
    const session = { role: 'sales' as const, user: 'Renamed employee', userId: 57 };
    expect(matchesFormalUser(session, { ownerName: 'Original employee', salesUserId: 57 } as any)).toBe(true);
    expect(matchesFormalUser(session, { ownerName: 'Renamed employee', salesUserId: 58 } as any)).toBe(false);
    expect(matchesFormalUser(session, { ownerName: 'Renamed employee' })).toBe(false);
  });
  it('limits a manager configured for own data to their stable identity', () => {
    const items = [{ ownerName: 'Former name', ownerId: 57 }, { ownerName: 'Other', ownerId: 58 }];
    expect(filterVisibleFormalItems(items, { role: 'sales_manager', user: 'New name', userId: 57, dataScope: 'own_sales' } as any, ['sales_manager'])).toEqual([items[0]]);
  });
  it('reads verified identity and data scope headers', () => {
    expect(readFormalSession({ 'x-erp-role': 'sales', 'x-erp-user': 'Amy', 'x-erp-user-id': '57', 'x-erp-data-scope': 'own_sales' } as any)).toMatchObject({ userId: 57, dataScope: 'own_sales' });
  });
  it('returns a real new employee ID and preserves it across rename and deactivation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'erp-identity-'));
    const previousDataDir = process.env.ERP_DATA_DIR;
    process.env.ERP_DATA_DIR = dir;
    const service = new UserManagementService();
    const liveStore = (service as any).store as UserManagementRuntimeStore;
    try {
      const created = await service.create({ username: 'newemployee', realName: 'New employee', password: 'secret', roleCode: 'sales', createdBy: 'admin' });
      expect(await service.authenticate({ username: 'newemployee', password: 'secret' })).toMatchObject({ userId: created.id, user: 'New employee' });
      const sales = new SalesOrderService();
      const controller = new SalesOrderController(sales);
      await expect((controller.create as any)({ customerName: 'Customer', title: 'Wrong owner', salesUserId: 3, createdBy: 2000 }, String(created.id), 'sales')).rejects.toThrow();
      const order = await (controller.create as any)({ customerName: 'Customer', title: 'My order', salesUserId: created.id, createdBy: 2000 }, String(created.id), 'sales');
      expect(order.createdBy).toBe(created.id);
      await (controller.submit as any)(order.id, { currentStatus: 'draft' }, String(created.id));
      await (controller.reject as any)(order.id, { currentStatus: 'pending_sales_manager_approval', rejectionReason: '请核对客户要求' }, '2');
      const actorLogs = await sales.listAuditLogs();
      expect(actorLogs.items.find(log => log.operationType === 'submit_sales_order')?.operatorId).toBe(created.id);
      expect(actorLogs.items.find(log => log.operationType === 'reject_sales_order')?.operatorId).toBe(2);
      const quotes = new QuoteService();
      const quote = await quotes.create({ customerId: 1001, salesUserId: created.id, sourceCode: 'expo', requirements: 'Test', items: [{ productId: 1, sku: 'SKU-1', productName: 'Test product', unit: 'set', quantity: 1, salePrice: 12 }] });
      expect(quote.salesUserName).toBe('New employee');
      await quotes.submitDraftQuote(quote.id, created.id);
      await quotes.confirmQuotePrice(quote.id, { currentVersionNo: 1, items: [{ lineNo: 1, confirmedSalePrice: 13 }] }, { role: 'boss', user: 'Boss', userId: 1 });
      expect((await quotes.listAuditLogs()).items.find(log => log.operationType === 'boss_confirm_quote_price')?.operatorId).toBe(1);
      liveStore.saveUsers(liveStore.listUsers().map(user => user.id === created.id ? { ...user, realName: 'Renamed employee' } : user));
      expect((await quotes.list({}, { role: 'sales', user: 'Renamed employee', userId: created.id } as any)).items.map(item => item.salesUserId)).toContain(created.id);
      expect((await quotes.getDetail(quote.id, { role: 'sales', user: 'Renamed employee', userId: created.id } as any)).salesUserId).toBe(created.id);
      expect(await service.getCurrentSession('newemployee')).toMatchObject({ userId: created.id, user: 'Renamed employee' });
      liveStore.saveUsers(liveStore.listUsers().map(user => user.id === created.id ? { ...user, status: 'inactive' as const } : user));
      expect(await service.getCurrentSession('newemployee')).toBeNull();
      await expect((controller.create as any)({ customerName: 'Customer', title: 'Disabled owner', salesUserId: created.id, createdBy: 1 }, '1', 'admin')).rejects.toThrow();
      const edited = await (controller.updateDraft as any)(order.id, { customerName: 'Customer', title: 'Historic order edit', salesUserId: created.id, createdBy: 1 }, '1', 'admin');
      expect(edited.createdBy).toBe(created.id);
      expect(edited.salesUserId).toBe(created.id);
      expect(liveStore.listUsers().find(user => user.id === created.id)?.id).toBe(created.id);
    } finally { if (previousDataDir === undefined) delete process.env.ERP_DATA_DIR; else process.env.ERP_DATA_DIR = previousDataDir; rmSync(dir, { recursive: true, force: true }); }
  });
});
