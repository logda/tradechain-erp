import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import {
  FORMAL_ROLES_KEY,
  type FormalRole,
} from '../src/auth/formal-role.decorator';
import { FormalRoleGuard } from '../src/auth/formal-role.guard';
import { FormalTodoController } from '../src/todo/formal-todo.controller';
import { FormalTodoService } from '../src/todo/formal-todo.service';

describe('FormalTodoController', () => {
  it('protects formal todos with all formal roles', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, FormalTodoController)).toEqual(
      expect.arrayContaining([FormalRoleGuard]),
    );
    expect(
      Reflect.getMetadata(
        FORMAL_ROLES_KEY,
        FormalTodoController.prototype.listFormalTodos,
      ) as FormalRole[] | undefined,
    ).toEqual([
      'admin',
      'boss',
      'sales_manager',
      'sales',
      'purchase_manager',
      'purchase',
    ]);
  });

  it('returns formal todo aggregation from the service', async () => {
    const listFormalTodos = jest.fn().mockResolvedValue({
      items: [{ id: 'quote-Q1', docNo: 'Q1' }],
      total: 1,
      closedTotal: 0,
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [FormalTodoController],
      providers: [{ provide: FormalTodoService, useValue: { listFormalTodos } }],
    }).compile();

    const controller = moduleRef.get(FormalTodoController);

    await expect(
      controller.listFormalTodos({ headers: {
        'x-erp-role': 'sales', 'x-erp-user': 'Zoe',
      } }),
    ).resolves.toEqual({
      items: [{ id: 'quote-Q1', docNo: 'Q1' }],
      total: 1,
      closedTotal: 0,
    });
    expect(listFormalTodos).toHaveBeenCalledWith({ role: 'sales', user: 'Zoe' });
  });
});
