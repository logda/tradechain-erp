import { SampleOrderService } from '../src/sample-order/sample-order.service';

describe('SampleOrderService list', () => {
  it('filters samples by advanced fields and returns applied filters', async () => {
    const service = new SampleOrderService();

    const result = await service.list({
      keyword: 'Acme',
      customerName: 'Acme',
      ownerName: 'Zoe',
      quoteNo: 'Q202607080001',
      isReplacement: 'no',
      isCancelled: 'no',
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.docNo)).toEqual(['SP202607080001']);
    expect(result.appliedFilters.isReplacement).toBe('no');
    expect(result.appliedFilters.isCancelled).toBe('no');
    expect(result.total).toBe(1);
  });

  it('filters by shared status and paginates', async () => {
    const service = new SampleOrderService();

    const result = await service.list({
      status: 'canceled',
      page: 1,
      pageSize: 1,
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
  });

  it('limits sales users to their own sample orders while sales managers see all', async () => {
    const service = new SampleOrderService();

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
      'SP202607080001',
      'SP202607080003',
    ]);
    expect(
      salesUserResult.items.every(
        (item) => item.ownerName === 'Zoe' || item.createdBy === 'Zoe',
      ),
    ).toBe(true);
    expect(managerResult.total).toBeGreaterThan(salesUserResult.total);
    expect(managerResult.items.map((item) => item.docNo)).toEqual([
      'SP202607080001',
      'SP202607080002',
      'SP202607080003',
    ]);
  });

  it('shows sample orders only for the matching sales user', async () => {
    const service = new SampleOrderService();

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
      'SP202607080001',
      'SP202607080003',
    ]);
    expect(
      result.items.every((item) => item.ownerName === 'Zoe' || item.createdBy === 'Zoe'),
    ).toBe(true);
  });
});
