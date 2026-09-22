import { Test } from '@nestjs/testing';
import { QuoteController } from '../src/quote/quote.controller';
import { QuoteService } from '../src/quote/quote.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('QuoteController list', () => {
  it('normalizes list query params before forwarding them', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        { provide: QuoteService, useValue: { list } },
        { provide: SalesOrderService, useValue: { convertConfirmedQuote: jest.fn() } },
      ],
    }).compile();

    const controller = moduleRef.get(QuoteController);
    const result = await controller.list({
      keyword: 'Acme',
      documentType: 'demand',
      sourceType: 'tiktok',
      bossConfirmed: 'yes',
      page: '2',
      pageSize: '5',
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(list).toHaveBeenCalledWith({
      keyword: 'Acme',
      documentType: 'demand',
      sourceType: 'tiktok',
      bossConfirmed: 'yes',
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
      controllers: [QuoteController],
      providers: [
        { provide: QuoteService, useValue: { list } },
        { provide: SalesOrderService, useValue: { convertConfirmedQuote: jest.fn() } },
      ],
    }).compile();

    const controller = moduleRef.get(QuoteController);
    await controller.list({
      bossConfirmed: 'bogus' as 'all',
      page: 'NaN',
      pageSize: '0',
      sortBy: 'bogus',
    });

    expect(list).toHaveBeenCalledWith({
      bossConfirmed: 'all',
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }, undefined);
  });
});
