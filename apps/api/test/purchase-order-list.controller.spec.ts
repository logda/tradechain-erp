import { Test } from '@nestjs/testing';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';

describe('PurchaseOrderController list', () => {
  it('normalizes list query params before forwarding them', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [{ provide: PurchaseOrderService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(PurchaseOrderController);
    const result = await controller.list({
      keyword: 'Acme',
      approvalStatus: 'purchasing',
      isResubmitted: 'yes',
      salesOrderNo: 'S202607080001',
      page: '2',
      pageSize: '5',
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(list).toHaveBeenCalledWith({
      keyword: 'Acme',
      approvalStatus: 'purchasing',
      isResubmitted: 'yes',
      salesOrderNo: 'S202607080001',
      page: 2,
      pageSize: 5,
      sortBy: 'docNo',
      sortOrder: 'asc',
    }, undefined);
    expect(result.page).toBe(2);
  });

  it('falls back to safe defaults for invalid sort, tri-state, and pagination params', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [{ provide: PurchaseOrderService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(PurchaseOrderController);
    await controller.list({
      isResubmitted: 'bogus' as 'all',
      page: 'NaN',
      pageSize: '0',
      sortBy: 'bogus',
    });

    expect(list).toHaveBeenCalledWith({
      isResubmitted: 'all',
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }, undefined);
  });
});
