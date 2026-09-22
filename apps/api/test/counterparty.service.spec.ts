import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CounterpartyService } from '../src/counterparty/counterparty.service';

describe('CounterpartyService', () => {
  it('lists seeded counterparties and filters by type and keyword', async () => {
    const service = new CounterpartyService();

    const result = await service.list({
      type: 'customer',
      keyword: 'Acme',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      code: 'CUST-ACME',
      name: 'Acme Trading',
      shortName: '星河贸易',
      type: 'customer',
      status: 'active',
    });
  });

  it('paginates filtered counterparties after sorting', async () => {
    const service = new CounterpartyService();

    await service.create({
      type: 'customer',
      code: 'CUST-BETA',
      name: 'Beta Trading',
      shortName: 'Beta',
      region: 'Shanghai',
      ownerName: 'Zoe',
      contactName: 'Bella',
      phone: '13800000010',
      address: 'Shanghai Pudong新区 1 号',
      bankName: '招商银行上海分行',
      bankAccount: '6222000000000010',
      remark: '重点客户',
      createdBy: 'Admin',
    });
    await service.create({
      type: 'customer',
      code: 'CUST-DELTA',
      name: 'Delta Trading',
      shortName: 'Delta',
      region: 'Ningbo',
      ownerName: 'Zoe',
      contactName: 'Daisy',
      phone: '13800000011',
      address: 'Ningbo Beilun 8 号',
      bankName: '中国银行宁波分行',
      bankAccount: '6222000000000011',
      remark: '月结客户',
      createdBy: 'Admin',
    });

    const result = await service.list({ page: '2', pageSize: '2' });

    expect(result.total).toBe(6);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.items.map((item) => item.code)).toEqual(['CUST-BETA', 'CUST-DELTA']);
  });

  it('creates a new supplier counterparty with audit fields', async () => {
    const service = new CounterpartyService();

    const created = await service.create({
      type: 'supplier',
      code: 'SUP-GAMMA',
      name: 'Gamma Components',
      shortName: 'Gamma',
      region: 'Shenzhen',
      ownerName: 'Leo',
      contactName: 'Grace',
      phone: '13800000000',
      address: 'Shenzhen Baoan 99 号',
      bankName: '平安银行深圳分行',
      bankAccount: '6222000000000001',
      remark: '核心供应商',
      createdBy: 'Admin',
    });

    expect(created).toMatchObject({
      id: expect.any(Number),
      type: 'supplier',
      code: 'SUP-GAMMA',
      name: 'Gamma Components',
      shortName: 'Gamma',
      region: 'Shenzhen',
      status: 'active',
      ownerName: 'Leo',
      address: 'Shenzhen Baoan 99 号',
      bankName: '平安银行深圳分行',
      bankAccount: '6222000000000001',
      remark: '核心供应商',
      createdBy: 'Admin',
    });

    const listed = await service.list({ ownerName: 'Leo' });
    expect(listed.items.map((item) => item.code)).toContain('SUP-GAMMA');
  });

  it('allows optional counterparty fields to be empty on create', async () => {
    const service = new CounterpartyService();

    const created = await service.create({
      type: 'supplier',
      code: 'SUP-OPTIONAL',
      name: 'Optional Parts',
      shortName: '',
      region: '',
      ownerName: 'Leo',
      contactName: '',
      phone: '',
      address: '',
      bankName: '',
      bankAccount: '',
      remark: '',
      createdBy: 'Admin',
    });

    expect(created).toMatchObject({
      type: 'supplier',
      code: 'SUP-OPTIONAL',
      name: 'Optional Parts',
      ownerName: 'Leo',
      shortName: '',
      region: '',
      contactName: '',
      phone: '',
      address: '',
      bankName: '',
      bankAccount: '',
      remark: '',
      status: 'active',
    });
  });

  it('rejects create when required formal counterparty fields are missing', async () => {
    const service = new CounterpartyService();

    await expect(
      service.create({
        type: 'customer',
        code: 'CUST-MISS',
        name: 'Missing Fields Trading',
        shortName: '',
        region: '',
        ownerName: '',
        contactName: '',
        phone: '',
        address: '',
        bankName: '',
        bankAccount: '',
        remark: '',
        createdBy: 'Admin',
      }),
    ).rejects.toThrow('请完整填写以下必填项：所属人员');
  });

  it('rejects duplicate counterparty codes', async () => {
    const service = new CounterpartyService();

    await expect(
      service.create({
        type: 'customer',
        code: 'CUST-ACME',
        name: 'Acme Duplicate',
        shortName: 'Acme',
        region: 'United States',
        ownerName: 'Zoe',
        contactName: 'Amy',
        phone: '+1-202-555-0101',
        address: '5th Avenue 10',
        bankName: 'Bank of America',
        bankAccount: '1234567890',
        remark: '重复编码校验',
        createdBy: 'Admin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates editable counterparty fields without changing audit creation fields', async () => {
    const service = new CounterpartyService();

    const updated = await service.update(1, {
      name: 'Acme Trading Group',
      shortName: 'Acme Group',
      region: 'Los Angeles',
      ownerName: 'Zoe',
      contactName: 'Alice',
      phone: '+1-202-555-0188',
      address: 'Los Angeles Harbor 88 号',
      bankName: 'Citibank LA Branch',
      bankAccount: '998800776655',
      remark: '正式版资料已完善',
      updatedBy: 'Admin',
    });

    expect(updated).toMatchObject({
      id: 1,
      name: 'Acme Trading Group',
      shortName: 'Acme Group',
      region: 'Los Angeles',
      contactName: 'Alice',
      phone: '+1-202-555-0188',
      address: 'Los Angeles Harbor 88 号',
      bankName: 'Citibank LA Branch',
      bankAccount: '998800776655',
      remark: '正式版资料已完善',
      createdBy: 'system',
      updatedBy: 'Admin',
    });
  });

  it('deactivates a counterparty with soft delete semantics', async () => {
    const service = new CounterpartyService();

    const deactivated = await service.deactivate(2, {
      operatedBy: 'Admin',
      reason: '长期无交易',
    });

    expect(deactivated).toMatchObject({
      id: 2,
      status: 'inactive',
      deactivatedBy: 'Admin',
      deactivatedReason: '长期无交易',
    });

    const inactive = await service.list({ status: 'inactive' });
    expect(inactive.items.map((item) => item.id)).toContain(2);
  });

  it('reactivates a deactivated counterparty with soft delete semantics', async () => {
    const service = new CounterpartyService();

    await service.deactivate(2, {
      operatedBy: 'Admin',
      reason: '长期无交易',
    });

    const activated = await service.activate(2, {
      operatedBy: 'Admin',
      reason: '恢复合作',
    });

    expect(activated).toMatchObject({
      id: 2,
      status: 'active',
    });
    expect(activated.deactivatedBy).toBeUndefined();
    expect(activated.deactivatedReason).toBeUndefined();

    const active = await service.list({ status: 'active' });
    expect(active.items.map((item) => item.id)).toContain(2);
  });

  it('throws not found when updating a missing counterparty', async () => {
    const service = new CounterpartyService();

    await expect(
      service.update(999, {
        name: 'Missing',
        updatedBy: 'Admin',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records and lists counterparty audit logs', async () => {
    const service = new CounterpartyService();

    await service.create({
      type: 'supplier',
      code: 'SUP-DELTA',
      name: 'Delta Parts',
      shortName: 'Delta',
      region: 'Shenzhen',
      ownerName: 'Leo',
      contactName: 'Dora',
      phone: '13800000001',
      address: 'Shenzhen Nanshan 18 号',
      bankName: '工商银行深圳分行',
      bankAccount: '6222000000000018',
      remark: '支持加急交付',
      createdBy: 'Admin',
    });

    const result = await service.listAuditLogs();

    expect(result.items[0]).toMatchObject({
      bizType: 'counterparty',
      operationType: 'create_counterparty',
    });
  });
});
