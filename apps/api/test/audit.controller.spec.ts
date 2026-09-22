import { Test } from '@nestjs/testing';
import { AuditController } from '../src/audit/audit.controller';
import { AuditService } from '../src/audit/audit.service';

describe('AuditController', () => {
  it('delegates unified audit log loading to AuditService', async () => {
    const list = jest.fn().mockResolvedValue({
      modules: [{ key: 'quotes', label: '报价 Quote', count: 1, failed: false }],
      items: [
        {
          id: 1,
          moduleKey: 'quotes',
          moduleLabel: '报价 Quote',
          bizType: 'quote',
          bizId: 100,
          operationType: 'create',
          operatorId: 10,
          createdAt: '2026-07-13T08:00:00.000Z',
        },
      ],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(AuditController);
    const result = await controller.list();

    expect(list).toHaveBeenCalled();
    expect(result.modules[0]).toMatchObject({
      key: 'quotes',
      failed: false,
    });
    expect(result.items[0].moduleLabel).toBe('报价 Quote');
  });
});
