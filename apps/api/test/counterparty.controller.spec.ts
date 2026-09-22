import { ParseIntPipe } from '@nestjs/common';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { AdminOnlyGuard } from '../src/auth/admin-only.guard';
import { FORMAL_ACTIONS_KEY } from '../src/auth/formal-role.decorator';
import { CounterpartyController } from '../src/counterparty/counterparty.controller';
import { CounterpartyService } from '../src/counterparty/counterparty.service';

describe('CounterpartyController', () => {
  it('protects counterparty master data with admin and action permissions', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CounterpartyController)).toEqual(
      expect.arrayContaining([AdminOnlyGuard]),
    );
    expect(
      Reflect.getMetadata(
        FORMAL_ACTIONS_KEY,
        CounterpartyController.prototype.create,
      ),
    ).toEqual(['master_data.write']);
    expect(
      Reflect.getMetadata(
        FORMAL_ACTIONS_KEY,
        CounterpartyController.prototype.update,
      ),
    ).toEqual(['master_data.write']);
    expect(
      Reflect.getMetadata(
        FORMAL_ACTIONS_KEY,
        CounterpartyController.prototype.deactivate,
      ),
    ).toEqual(['master_data.write']);
    expect(
      Reflect.getMetadata(
        FORMAL_ACTIONS_KEY,
        CounterpartyController.prototype.activate,
      ),
    ).toEqual(['master_data.write']);
  });

  it('passes normalized list query parameters to the service', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 5 });
    const moduleRef = await Test.createTestingModule({
      controllers: [CounterpartyController],
      providers: [{ provide: CounterpartyService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(CounterpartyController);
    await controller.list({
      type: 'customer',
      keyword: 'Acme',
      status: 'active',
      page: '2',
      pageSize: '5',
    });

    expect(list).toHaveBeenCalledWith({
      type: 'customer',
      keyword: 'Acme',
      status: 'active',
      page: 2,
      pageSize: 5,
    });
  });

  it('falls back to safe list pagination defaults', async () => {
    const list = jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    const moduleRef = await Test.createTestingModule({
      controllers: [CounterpartyController],
      providers: [{ provide: CounterpartyService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(CounterpartyController);
    await controller.list({
      page: 'NaN',
      pageSize: '0',
    });

    expect(list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
  });

  it('creates a counterparty from form input', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 9,
      code: 'SUP-GAMMA',
      status: 'active',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [CounterpartyController],
      providers: [{ provide: CounterpartyService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(CounterpartyController);
    const result = await controller.create({
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

    expect(create).toHaveBeenCalledWith({
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
    expect(result.status).toBe('active');
  });

  it('updates a counterparty by id', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 9,
      name: 'Gamma Components Ltd.',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [CounterpartyController],
      providers: [{ provide: CounterpartyService, useValue: { update } }],
    }).compile();

    const controller = moduleRef.get(CounterpartyController);
    const result = await controller.update(9, {
      name: 'Gamma Components Ltd.',
      shortName: 'Gamma Ltd.',
      address: 'Shenzhen Qianhai 66 号',
      bankName: '招商银行深圳分行',
      bankAccount: '6222000000000066',
      remark: '更新银行账户',
      updatedBy: 'Admin',
    });

    expect(update).toHaveBeenCalledWith(9, {
      name: 'Gamma Components Ltd.',
      shortName: 'Gamma Ltd.',
      address: 'Shenzhen Qianhai 66 号',
      bankName: '招商银行深圳分行',
      bankAccount: '6222000000000066',
      remark: '更新银行账户',
      updatedBy: 'Admin',
    });
    expect(result.name).toBe('Gamma Components Ltd.');
  });

  it('deactivates a counterparty by id', async () => {
    const deactivate = jest.fn().mockResolvedValue({
      id: 9,
      status: 'inactive',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [CounterpartyController],
      providers: [{ provide: CounterpartyService, useValue: { deactivate } }],
    }).compile();

    const controller = moduleRef.get(CounterpartyController);
    const result = await controller.deactivate(9, {
      operatedBy: 'Admin',
      reason: '长期无交易',
    });

    expect(deactivate).toHaveBeenCalledWith(9, {
      operatedBy: 'Admin',
      reason: '长期无交易',
    });
    expect(result.status).toBe('inactive');
  });

  it('activates a counterparty by id', async () => {
    const activate = jest.fn().mockResolvedValue({
      id: 9,
      status: 'active',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [CounterpartyController],
      providers: [{ provide: CounterpartyService, useValue: { activate } }],
    }).compile();

    const controller = moduleRef.get(CounterpartyController);
    const result = await controller.activate(9, {
      operatedBy: 'Admin',
      reason: '恢复合作',
    });

    expect(activate).toHaveBeenCalledWith(9, {
      operatedBy: 'Admin',
      reason: '恢复合作',
    });
    expect(result.status).toBe('active');
  });

  it('lists counterparty audit logs from the controller', async () => {
    const listAuditLogs = jest.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          bizType: 'counterparty',
          bizId: 9,
          operationType: 'create_counterparty',
        },
      ],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [CounterpartyController],
      providers: [{ provide: CounterpartyService, useValue: { listAuditLogs } }],
    }).compile();

    const controller = moduleRef.get(CounterpartyController);
    const result = await controller.listAuditLogs();

    expect(listAuditLogs).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });

  it('uses ParseIntPipe for id params', () => {
    const updateMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      CounterpartyController,
      'update',
    ) as Record<string, { pipes: unknown[] }>;
    const deactivateMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      CounterpartyController,
      'deactivate',
    ) as Record<string, { pipes: unknown[] }>;
    const activateMetadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      CounterpartyController,
      'activate',
    ) as Record<string, { pipes: unknown[] }>;

    expect(updateMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
    expect(deactivateMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
    expect(activateMetadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
