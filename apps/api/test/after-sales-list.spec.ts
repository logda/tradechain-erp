import { AfterSalesService } from '../src/after-sales/after-sales.service';

describe('AfterSalesService list', () => {
  it('filters after-sales orders by advanced fields and returns applied filters', async () => {
    const service = new AfterSalesService();

    const result = await service.list({
      keyword: 'Acme',
      customerName: 'Acme',
      type: 'refund',
      financeReviewStatus: 'confirmed',
      receiptCollectionStatus: 'fully_paid',
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.docNo)).toEqual(['AS202607080001']);
    expect(result.appliedFilters.type).toBe('refund');
    expect(result.total).toBe(1);
  });

  it('filters by shared status and paginates', async () => {
    const service = new AfterSalesService();

    const result = await service.list({
      status: 'processing',
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

  it('limits purchase users to their own after-sales orders while purchase managers see all', async () => {
    const service = new AfterSalesService();

    const purchaseUserResult = await service.list(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'docNo',
        sortOrder: 'asc',
      },
      { role: 'purchase', user: 'Leo' },
    );
    const managerResult = await service.list(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'docNo',
        sortOrder: 'asc',
      },
      { role: 'purchase_manager', user: 'Mia' },
    );

    expect(purchaseUserResult.items.map((item) => item.docNo)).toEqual([
      'AS202607080002',
    ]);
    expect(
      purchaseUserResult.items.every(
        (item) => item.ownerName === 'Leo' || item.createdBy === 'Leo',
      ),
    ).toBe(true);
    expect(managerResult.total).toBeGreaterThan(purchaseUserResult.total);
    expect(managerResult.items.map((item) => item.docNo)).toEqual([
      'AS202607080001',
      'AS202607080002',
      'AS202607080003',
    ]);
  });

  it('shows after-sales orders only for the matching purchase user', async () => {
    const service = new AfterSalesService();

    const result = await service.list(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'docNo',
        sortOrder: 'asc',
      },
      { role: 'purchase', user: 'Leo' },
    );

    expect(result.items.map((item) => item.docNo)).toEqual([
      'AS202607080002',
    ]);
    expect(
      result.items.every((item) => item.ownerName === 'Leo' || item.createdBy === 'Leo'),
    ).toBe(true);
  });

  it('lets purchase users open the after-sales detail exposed by their todo list', async () => {
    const service = new AfterSalesService();

    await expect(
      service.getDetail(2, { role: 'purchase', user: 'Leo' }),
    ).resolves.toMatchObject({
      id: 2,
      afterSalesNo: 'AS202607080002',
      status: 'pending_approval',
      financeReviewStatus: 'pending',
    });

    await expect(
      service.getDetail(1, { role: 'purchase', user: 'Leo' }),
    ).rejects.toThrow('售后单不存在');
  });
});
