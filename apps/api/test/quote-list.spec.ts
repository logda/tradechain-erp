import { QuoteService } from '../src/quote/quote.service';

describe('QuoteService list', () => {
  it('filters quotes by advanced fields and returns applied filters', async () => {
    const service = new QuoteService();

    const result = await service.list({
      keyword: 'Acme',
      customerName: 'Acme',
      sourceType: 'expo',
      bossConfirmed: 'yes',
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.docNo)).toEqual(['Q202607080001']);
    expect(result.items[0]?.customerFullName).toBe('星河贸易');
    expect(result.appliedFilters.bossConfirmed).toBe('yes');
    expect(result.total).toBe(1);
  });

  it('filters by shared status and paginates', async () => {
    const service = new QuoteService();

    const result = await service.list({
      status: 'quoted',
      page: 1,
      pageSize: 1,
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
  });

  it('filters quotes by document type', async () => {
    const service = new QuoteService();

    const demandResult = await service.list({
      documentType: 'demand',
      page: 1,
      pageSize: 20,
      sortBy: 'docNo',
      sortOrder: 'asc',
    });
    const quoteResult = await service.list({
      documentType: 'quote',
      page: 1,
      pageSize: 20,
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(demandResult.items.map((item) => item.docNo)).toEqual([
      'XQ202607080003',
    ]);
    expect(demandResult.appliedFilters.documentType).toBe('demand');
    expect(quoteResult.items.map((item) => item.docNo)).toEqual([
      'Q202607080001',
      'Q202607080002',
    ]);
  });

  it('limits sales users to their own quotes while sales managers see all', async () => {
    const service = new QuoteService();

    const salesUserResult = await service.list(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'docNo',
        sortOrder: 'asc',
      },
      { role: 'sales', user: 'Zoe' },
    );
    const managerResult = await service.list(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'docNo',
        sortOrder: 'asc',
      },
      { role: 'sales_manager', user: 'Mia' },
    );

    expect(salesUserResult.items.map((item) => item.docNo)).toEqual([
      'Q202607080001',
      'XQ202607080003',
    ]);
    expect(salesUserResult.items.every((item) => item.createdBy === 'Zoe')).toBe(
      true,
    );
    expect(managerResult.total).toBeGreaterThan(salesUserResult.total);
    expect(managerResult.items.map((item) => item.docNo)).toEqual([
      'Q202607080001',
      'Q202607080002',
      'XQ202607080003',
    ]);
  });

  it('shows sales quotes only for the matching sales user', async () => {
    const service = new QuoteService();

    const result = await service.list(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'docNo',
        sortOrder: 'asc',
      },
      { role: 'sales', user: 'Zoe' },
    );

    expect(result.items.map((item) => item.docNo)).toEqual([
      'Q202607080001',
      'XQ202607080003',
    ]);
    expect(result.items.every((item) => item.createdBy === 'Zoe')).toBe(true);
  });

  it('filters runtime-created quotes by dynamic source type', async () => {
    const service = new QuoteService();

    await service.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'tiktok',
      requirements: 'runtime source filter',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 120,
          salePrice: 15.9,
        },
      ],
    });

    const result = await service.list({
      sourceType: 'tiktok',
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sourceType).toBe('tiktok');
    expect(result.appliedFilters.sourceType).toBe('tiktok');
  });
});
