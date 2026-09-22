import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('SalesOrderService list', () => {
  it('filters sales orders by advanced fields and returns applied filters', async () => {
    const service = new SalesOrderService();

    const result = await service.list({
      keyword: 'Acme',
      customerName: 'Acme',
      approvalStatus: 'purchasing',
      hasAfterSales: 'yes',
      sourceMode: 'from_quote_with_inquiry',
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.docNo)).toEqual(['S202607080001']);
    expect(result.appliedFilters.hasAfterSales).toBe('yes');
    expect(result.appliedFilters.sourceMode).toBe('from_quote_with_inquiry');
    expect(result.total).toBe(1);
  });

  it('maps the shared status filter to approval or fulfillment status and paginates', async () => {
    const service = new SalesOrderService();

    const result = await service.list({
      status: 'purchasing',
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

  it('limits sales users to their own sales orders while sales managers see all', async () => {
    const service = new SalesOrderService();

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
      'S202607080001',
      'S202607080003',
    ]);
    expect(
      salesUserResult.items.every(
        (item) => item.ownerName === 'Zoe' || item.createdBy === 'Zoe',
      ),
    ).toBe(true);
    expect(managerResult.total).toBeGreaterThan(salesUserResult.total);
    expect(managerResult.items.map((item) => item.docNo)).toEqual([
      'S202607080001',
      'S202607080002',
      'S202607080003',
    ]);
  });
});
