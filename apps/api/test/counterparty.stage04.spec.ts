import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CounterpartyController } from '../src/counterparty/counterparty.controller';
import { CounterpartyService } from '../src/counterparty/counterparty.service';
import type { UserManagementService } from '../src/user-management/user-management.service';

const users = [
  { id: 1, username: 'admin', realName: '系统管理员', roleCode: 'admin', status: 'active', fullAccess: true },
  { id: 2, username: 'mia', realName: 'Mia', roleCode: 'boss', status: 'active', fullAccess: true },
  { id: 3, username: 'zoe', realName: 'Zoe', roleCode: 'sales', status: 'active', fullAccess: false },
  { id: 4, username: 'amy', realName: 'Amy', roleCode: 'sales', status: 'active', fullAccess: false },
  { id: 5, username: 'leo', realName: 'Leo', roleCode: 'purchase', status: 'active', fullAccess: false },
];
const request = (role: string, user: string) => ({ headers: { 'x-erp-role': role, 'x-erp-user': user } });
const payload = (code: string, ownerName: string) => ({
  type: 'customer', code, name: code, shortName: '', region: '', ownerName,
  contactName: '', phone: '', address: '', bankName: '', bankAccount: '', remark: '', createdBy: 'forged',
});

describe('counterparty stage04 runtime scenario', () => {
  let directory: string;
  const previousDirectory = process.env.ERP_DATA_DIR;
  const previousMode = process.env.ERP_STORAGE_MODE;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'erp-counterparty-stage04-'));
    process.env.ERP_DATA_DIR = directory;
    process.env.ERP_STORAGE_MODE = 'runtime';
  });
  afterEach(() => {
    if (previousDirectory === undefined) delete process.env.ERP_DATA_DIR;
    else process.env.ERP_DATA_DIR = previousDirectory;
    if (previousMode === undefined) delete process.env.ERP_STORAGE_MODE;
    else process.env.ERP_STORAGE_MODE = previousMode;
    rmSync(directory, { recursive: true, force: true });
  });

  it('enforces owner scope on list, create and edit, and attributes writes to the session', async () => {
    const service = new CounterpartyService();
    const directoryService = { listActiveCounterpartyOwners: async () => users } as unknown as UserManagementService;
    const controller = new CounterpartyController(service, directoryService);

    expect((await controller.list({ type: 'customer' }, request('sales', 'Zoe'))).items.map((item) => item.ownerName)).toEqual(['Zoe']);
    expect((await controller.list({ type: 'supplier' }, request('purchase', 'Leo'))).items.every((item) => item.ownerName === 'Leo')).toBe(true);
    expect((await controller.list({ type: 'customer' }, request('sales_manager', 'Sara'))).total).toBeGreaterThan(0);
    await expect(controller.create(payload('CUST-FORGED', 'Amy'), request('sales', 'Zoe'))).rejects.toThrow(ForbiddenException);
    const created = await controller.create(payload('CUST-ZOE-04', 'Zoe'), request('sales', 'Zoe'));
    expect(created.createdBy).toBe('Zoe');
    await expect(controller.update(created.id, { ownerName: 'Amy', updatedBy: 'forged' }, request('sales', 'Zoe'))).rejects.toThrow(ForbiddenException);
    await expect(controller.update(created.id, { name: 'changed', updatedBy: 'forged' }, request('sales', 'Amy'))).rejects.toThrow(ForbiddenException);
    const updated = await controller.update(created.id, { name: 'changed', updatedBy: 'forged' }, request('sales', 'Zoe'));
    expect(updated.updatedBy).toBe('Zoe');
    const reassigned = await controller.update(created.id, { ownerName: 'Amy', updatedBy: 'forged' }, request('sales_manager', 'Sara'));
    expect(reassigned.ownerName).toBe('Amy');
  });

  it('keeps deleted custom values in storage while hiding them in ordinary responses', async () => {
    const service = new CounterpartyService();
    const field = await service.createCustomField({ name: '合作日期', type: 'date', createdBy: 'Mia' });
    const number = await service.createCustomField({ name: '额度', type: 'number', createdBy: 'Mia' });
    await expect(service.create({ ...payload('CUST-BAD-04', 'Zoe'), customValues: { [String(field.id)]: '2026-02-31' } })).rejects.toThrow(BadRequestException);
    const created = await service.create({
      ...payload('CUST-VALUES-04', 'Zoe'), paymentMethod: '电汇', settlementMethod: '月结', unitTags: ['重点', '重点', '长期'],
      openingReceivable: '125.50', moldFee: '20.00',
      customValues: { [String(field.id)]: '2026-09-24', [String(number.id)]: '3.5' },
    });
    expect(created.unitTags).toEqual(['重点', '长期']);
    expect(created.customValues).toEqual({ [String(field.id)]: '2026-09-24', [String(number.id)]: '3.5' });
    await service.deleteCustomField(field.id);
    const afterDelete = await service.findById(created.id);
    expect(afterDelete?.customValues).toEqual({ [String(number.id)]: '3.5' });
    await expect(service.update(created.id, { customValues: { [String(field.id)]: '2026-09-25' }, updatedBy: 'Zoe' })).rejects.toThrow(BadRequestException);
    await service.update(created.id, { paymentMethod: '信用证', updatedBy: 'Zoe' });
    const stored = JSON.parse(readFileSync(join(directory, 'counterparty-runtime.json'), 'utf8'));
    expect(stored.counterparties.find((item: { id: number }) => item.id === created.id).customValues[String(field.id)]).toBe('2026-09-24');
    expect((await new CounterpartyService().findById(created.id))?.paymentMethod).toBe('信用证');
    expect((await service.listAuditLogs()).items.some((item) => JSON.stringify((item.afterData as { customValues?: Record<string, string> } | null)?.customValues ?? {}).includes('2026-09-24'))).toBe(false);
  });

  it('limits active custom fields to ten and releases a slot after soft deletion', async () => {
    const service = new CounterpartyService();
    const fields = [];
    for (let i = 0; i < 10; i += 1) fields.push(await service.createCustomField({ name: `字段${i}`, type: 'text', createdBy: 'Admin' }));
    await expect(service.createCustomField({ name: '第十一项', type: 'text', createdBy: 'Admin' })).rejects.toThrow('上限');
    await service.deleteCustomField(fields[0].id);
    await service.createCustomField({ name: '新字段', type: 'text', createdBy: 'Admin' });
    expect((await service.listCustomFields())).toHaveLength(10);
  });
});
