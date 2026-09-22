import { Test } from '@nestjs/testing';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('SalesOrderController list', () => {
  it('normalizes list query params before forwarding them', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [{ provide: SalesOrderService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.list({
      keyword: 'Acme',
      approvalStatus: 'purchasing',
      hasAfterSales: 'yes',
      sourceMode: 'from_quote',
      page: '2',
      pageSize: '5',
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(list).toHaveBeenCalledWith({
      keyword: 'Acme',
      approvalStatus: 'purchasing',
      hasAfterSales: 'yes',
      sourceMode: 'from_quote',
      page: 2,
      pageSize: 5,
      sortBy: 'docNo',
      sortOrder: 'asc',
    }, undefined);
    expect(result.page).toBe(2);
  });

  it('falls back to safe defaults for invalid sort, source mode, and pagination params', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [{ provide: SalesOrderService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    await controller.list({
      sourceMode: 'bogus' as 'all',
      page: 'NaN',
      pageSize: '0',
      sortBy: 'bogus',
    });

    expect(list).toHaveBeenCalledWith({
      sourceMode: 'all',
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      hasAfterSales: 'all',
    }, undefined);
  });
});
