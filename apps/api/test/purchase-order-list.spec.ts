import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';

describe('PurchaseOrderService list', () => {
  it('filters purchase orders by advanced fields and returns applied filters', async () => {
    const service = new PurchaseOrderService();

    const result = await service.list({
      keyword: 'Acme',
      supplierName: 'Acme',
      approvalStatus: 'purchasing',
      isResubmitted: 'yes',
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.docNo)).toEqual(['P202607080001']);
    expect(result.appliedFilters.isResubmitted).toBe('yes');
    expect(result.total).toBe(1);
  });

  it('maps the shared status filter to approval or fulfillment status and paginates', async () => {
    const service = new PurchaseOrderService();

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

  it('limits purchase users to their own purchase orders while purchase managers see all', async () => {
    const service = new PurchaseOrderService();

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
      'P202607080002',
    ]);
    expect(
      purchaseUserResult.items.every(
        (item) => item.ownerName === 'Leo',
      ),
    ).toBe(true);
    expect(managerResult.total).toBeGreaterThan(purchaseUserResult.total);
    expect(managerResult.items.map((item) => item.docNo)).toEqual([
      'P202607080001',
      'P202607080002',
      'P202607080003',
    ]);
  });

  it('does not expose purchase orders to purchase users only because they created the document', async () => {
    const service = new PurchaseOrderService();

    const result = await service.list(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'docNo',
        sortOrder: 'asc',
      },
      { role: 'purchase', user: 'Mia' },
    );

    expect(result.items).toEqual([]);
  });
});
