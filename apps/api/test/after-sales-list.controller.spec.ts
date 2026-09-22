import { Test } from '@nestjs/testing';
import { AfterSalesController } from '../src/after-sales/after-sales.controller';
import { AfterSalesService } from '../src/after-sales/after-sales.service';

describe('AfterSalesController list', () => {
  it('normalizes list query params before forwarding them', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AfterSalesController],
      providers: [{ provide: AfterSalesService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(AfterSalesController);
    const result = await controller.list({
      keyword: 'Acme',
      type: 'refund',
      financeReviewStatus: 'confirmed',
      shipmentBatchNo: 'SB202607080001',
      page: '2',
      pageSize: '5',
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(list).toHaveBeenCalledWith({
      keyword: 'Acme',
      type: 'refund',
      financeReviewStatus: 'confirmed',
      shipmentBatchNo: 'SB202607080001',
      page: 2,
      pageSize: 5,
      sortBy: 'docNo',
      sortOrder: 'asc',
    }, undefined);
    expect(result.page).toBe(2);
  });

  it('falls back to safe defaults for invalid sort and pagination params', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AfterSalesController],
      providers: [{ provide: AfterSalesService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(AfterSalesController);
    await controller.list({
      page: 'NaN',
      pageSize: '0',
      sortBy: 'bogus',
    });

    expect(list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }, undefined);
  });

  it('drops invalid after-sales type values at the controller boundary', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AfterSalesController],
      providers: [{ provide: AfterSalesService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(AfterSalesController);
    await controller.list({
      type: 'bogus' as 'refund',
    });

    expect(list).toHaveBeenCalledWith({
      type: undefined,
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }, undefined);
  });
});
