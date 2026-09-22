import { Test } from '@nestjs/testing';
import { SampleOrderController } from '../src/sample-order/sample-order.controller';
import { SampleOrderService } from '../src/sample-order/sample-order.service';

describe('SampleOrderController list', () => {
  it('normalizes list query params before forwarding them', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleOrderController],
      providers: [{ provide: SampleOrderService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(SampleOrderController);
    const result = await controller.list({
      keyword: 'Acme',
      quoteNo: 'Q202607080001',
      isReplacement: 'no',
      isCancelled: 'yes',
      page: '2',
      pageSize: '5',
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(list).toHaveBeenCalledWith({
      keyword: 'Acme',
      quoteNo: 'Q202607080001',
      isReplacement: 'no',
      isCancelled: 'yes',
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
      controllers: [SampleOrderController],
      providers: [{ provide: SampleOrderService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(SampleOrderController);
    await controller.list({
      isReplacement: 'bogus' as 'all',
      isCancelled: 'bogus' as 'all',
      page: 'NaN',
      pageSize: '0',
      sortBy: 'bogus',
    });

    expect(list).toHaveBeenCalledWith({
      isReplacement: 'all',
      isCancelled: 'all',
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }, undefined);
  });
});
