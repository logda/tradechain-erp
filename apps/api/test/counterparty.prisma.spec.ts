import { CounterpartyService } from '../src/counterparty/counterparty.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('CounterpartyService prisma storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('creates counterparties in Prisma and writes audit logs', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T09:00:00.000Z');
    const prisma = {
      counterpartyCustomField: { findMany: jest.fn().mockResolvedValue([]) },
      counterparty: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 9n,
          type: 'supplier',
          code: 'SUP-OMEGA',
          name: 'Omega Parts',
          shortName: 'Omega',
          contactName: 'Olivia',
          phone: '13800000001',
          region: 'Shenzhen',
          address: 'Shenzhen Baoan 100 号',
          bankName: '招商银行深圳分行',
          bankAccount: '6222000000000100',
          remark: '战略供应商',
          email: null,
          paymentTerms: null,
          ownerName: 'Leo',
          status: 'active',
          createdBy: 'Admin',
          createdAt,
          updatedBy: null,
          updatedAt: createdAt,
          deactivatedAt: null,
          deactivatedBy: null,
          deactivatedReason: null,
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    } as unknown as PrismaService;

    const service = new CounterpartyService(prisma);
    const result = await service.create({
      type: 'supplier',
      code: ' sup-omega ',
      name: ' Omega Parts ',
      shortName: ' Omega ',
      region: ' Shenzhen ',
      ownerName: ' Leo ',
      contactName: 'Olivia',
      phone: '13800000001',
      address: ' Shenzhen Baoan 100 号 ',
      bankName: ' 招商银行深圳分行 ',
      bankAccount: ' 6222000000000100 ',
      remark: ' 战略供应商 ',
      createdBy: 'Admin',
    });

    expect(prisma.counterparty.findUnique).toHaveBeenCalledWith({
      where: { code: 'SUP-OMEGA' },
    });
    expect(prisma.counterparty.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'supplier',
        code: 'SUP-OMEGA',
        name: 'Omega Parts',
        shortName: 'Omega',
        region: 'Shenzhen',
        ownerName: 'Leo',
        address: 'Shenzhen Baoan 100 号',
        bankName: '招商银行深圳分行',
        bankAccount: '6222000000000100',
        remark: '战略供应商',
        status: 'active',
        createdBy: 'Admin',
      }),
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'counterparty',
        bizId: 9n,
        operationType: 'create_counterparty',
        operatorId: 0n,
      }),
    });
    expect(result).toMatchObject({
      id: 9,
      code: 'SUP-OMEGA',
      name: 'Omega Parts',
      shortName: 'Omega',
      address: 'Shenzhen Baoan 100 号',
      bankName: '招商银行深圳分行',
      bankAccount: '6222000000000100',
      remark: '战略供应商',
      status: 'active',
      createdAt: '2026-07-13T09:00:00.000Z',
    });
  });

  it('lists, updates, and deactivates counterparties through Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T09:00:00.000Z');
    const updatedAt = new Date('2026-07-13T10:00:00.000Z');
    const activeRecord = {
      id: 10n,
      type: 'both',
      code: 'CP-DELTA',
      name: 'Delta Group',
      shortName: 'Delta',
      contactName: 'Dora',
      phone: '13900000000',
      region: 'Ningbo',
      address: 'Ningbo Beilun 8 号',
      bankName: '中国银行宁波分行',
      bankAccount: '6222000000000008',
      remark: '双角色往来单位',
      email: null,
      paymentTerms: null,
      ownerName: 'Mia',
      status: 'active',
      createdBy: 'Admin',
      createdAt,
      updatedBy: null,
      updatedAt: createdAt,
      deactivatedAt: null,
      deactivatedBy: null,
      deactivatedReason: null,
    };
    const updatedRecord = {
      ...activeRecord,
      name: 'Delta Trading Group',
      shortName: 'Delta TG',
      address: 'Ningbo Beilun 18 号',
      bankAccount: '6222000000000018',
      remark: '已更新正式资料',
      updatedBy: 'Admin',
      updatedAt,
    };
    const deactivatedRecord = {
      ...updatedRecord,
      status: 'inactive',
      deactivatedAt: updatedAt,
      deactivatedBy: 'Admin',
      deactivatedReason: '长期无交易',
    };
    const prisma = {
      counterpartyCustomField: { findMany: jest.fn().mockResolvedValue([]) },
      counterparty: {
        findMany: jest.fn().mockResolvedValue([activeRecord]),
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(activeRecord)
          .mockResolvedValueOnce(updatedRecord),
        update: jest
          .fn()
          .mockResolvedValueOnce(updatedRecord)
          .mockResolvedValueOnce(deactivatedRecord),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 2n }),
      },
    } as unknown as PrismaService;

    const service = new CounterpartyService(prisma);
    const listed = await service.list({ type: 'supplier', keyword: 'delta' });
    const updated = await service.update(10, {
      name: 'Delta Trading Group',
      shortName: 'Delta TG',
      address: 'Ningbo Beilun 18 号',
      bankAccount: '6222000000000018',
      remark: '已更新正式资料',
      updatedBy: 'Admin',
    });
    const deactivated = await service.deactivate(10, {
      operatedBy: 'Admin',
      reason: '长期无交易',
    });

    expect(prisma.counterparty.findMany).toHaveBeenCalledWith({
      orderBy: { code: 'asc' },
    });
    expect(listed.items).toHaveLength(1);
    expect(prisma.counterparty.update).toHaveBeenNthCalledWith(1, {
      where: { id: 10n },
      data: expect.objectContaining({
        name: 'Delta Trading Group',
        shortName: 'Delta TG',
        address: 'Ningbo Beilun 18 号',
        bankAccount: '6222000000000018',
        remark: '已更新正式资料',
        updatedBy: 'Admin',
      }),
    });
    expect(prisma.counterparty.update).toHaveBeenNthCalledWith(2, {
      where: { id: 10n },
      data: expect.objectContaining({
        status: 'inactive',
        deactivatedBy: 'Admin',
        deactivatedReason: '长期无交易',
      }),
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'counterparty',
        bizId: 10n,
        operationType: 'update_counterparty',
      }),
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'counterparty',
        bizId: 10n,
        operationType: 'deactivate_counterparty',
      }),
    });
    expect(updated).toMatchObject({
      id: 10,
      name: 'Delta Trading Group',
      shortName: 'Delta TG',
      address: 'Ningbo Beilun 18 号',
      bankAccount: '6222000000000018',
      remark: '已更新正式资料',
      updatedBy: 'Admin',
    });
    expect(deactivated).toMatchObject({
      id: 10,
      status: 'inactive',
      deactivatedBy: 'Admin',
      deactivatedReason: '长期无交易',
    });
  });

  it('activates deactivated counterparties through Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T09:00:00.000Z');
    const deactivatedAt = new Date('2026-07-13T10:00:00.000Z');
    const inactiveRecord = {
      id: 11n,
      type: 'supplier',
      code: 'SUP-ECHO',
      name: 'Echo Parts',
      shortName: 'Echo',
      contactName: 'Evan',
      phone: '13800000022',
      region: 'Suzhou',
      address: 'Suzhou SIP 22 号',
      bankName: '中国银行苏州分行',
      bankAccount: '6222000000000022',
      remark: '待恢复合作',
      email: null,
      paymentTerms: null,
      ownerName: 'Leo',
      status: 'inactive',
      createdBy: 'Admin',
      createdAt,
      updatedBy: 'Admin',
      updatedAt: deactivatedAt,
      deactivatedAt,
      deactivatedBy: 'Admin',
      deactivatedReason: '暂停合作',
    };
    const activatedRecord = {
      ...inactiveRecord,
      status: 'active',
      deactivatedAt: null,
      deactivatedBy: null,
      deactivatedReason: null,
    };
    const prisma = {
      counterpartyCustomField: { findMany: jest.fn().mockResolvedValue([]) },
      counterparty: {
        findUnique: jest.fn().mockResolvedValue(inactiveRecord),
        update: jest.fn().mockResolvedValue(activatedRecord),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 3n }),
      },
    } as unknown as PrismaService;

    const service = new CounterpartyService(prisma);
    const activated = await service.activate(11, {
      operatedBy: 'Admin',
      reason: '恢复合作',
    });

    expect(prisma.counterparty.update).toHaveBeenCalledWith({
      where: { id: 11n },
      data: expect.objectContaining({
        status: 'active',
        deactivatedAt: null,
        deactivatedBy: null,
        deactivatedReason: null,
      }),
    });
    expect(prisma.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'counterparty',
        bizId: 11n,
        operationType: 'activate_counterparty',
      }),
    });
    expect(activated).toMatchObject({
      id: 11,
      status: 'active',
    });
  });

  it('keeps a deleted field value in Prisma JSON while returning only active fields', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-09-24T08:00:00.000Z');
    const existing = {
      id: 88n, type: 'customer', code: 'CUST-STAGE04', name: 'Example', shortName: '',
      region: null, ownerName: 'Zoe', contactName: null, phone: null, address: null,
      bankName: null, bankAccount: null, remark: null, email: null, paymentTerms: null,
      status: 'active', createdBy: 'Zoe', createdAt, updatedBy: null, updatedAt: createdAt,
      deactivatedAt: null, deactivatedBy: null, deactivatedReason: null,
      customValues: { '1': 'old hidden value', '2': 'old active value' },
    };
    const prisma = {
      counterpartyCustomField: {
        findMany: jest.fn().mockResolvedValue([{ id: 2n, name: '额度', type: 'number', createdBy: 'Admin', createdAt }]),
      },
      counterparty: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockImplementation(async ({ data }) => ({ ...existing, ...data, updatedAt: createdAt })),
      },
      operationLog: { create: jest.fn().mockResolvedValue({ id: 1n }) },
    } as unknown as PrismaService;
    const service = new CounterpartyService(prisma);
    const updated = await service.update(88, { customValues: { '2': '3.5' }, paymentMethod: '电汇', updatedBy: 'Zoe' });
    expect(prisma.counterparty.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customValues: { '1': 'old hidden value', '2': '3.5' }, paymentMethod: '电汇' }),
    }));
    expect(updated.customValues).toEqual({ '2': '3.5' });
  });
});
