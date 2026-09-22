import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';

describe('ShipmentBatchService list', () => {
  it('filters shipment batches by advanced fields and returns applied filters', async () => {
    const service = new ShipmentBatchService();

    const result = await service.list({
      keyword: 'Acme',
      supplierName: 'Acme',
      receiptSendStatus: 'sent',
      hasException: 'yes',
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.items.map((item) => item.docNo)).toEqual(['SH202607080001']);
    expect(result.appliedFilters.hasException).toBe('yes');
    expect(result.total).toBe(1);
  });

  it('filters by shared status and paginates', async () => {
    const service = new ShipmentBatchService();

    const result = await service.list({
      status: 'shipped',
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

  it('shows shipment batches to purchase users as a shared module', async () => {
    const service = new ShipmentBatchService();

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
      'SH202607080001',
      'SH202607080002',
      'SH202607080003',
    ]);
    expect(managerResult.items.map((item) => item.docNo)).toEqual([
      'SH202607080001',
      'SH202607080002',
      'SH202607080003',
    ]);
  });

  it('filters shipment batches by visible purchase orders for purchase users', async () => {
    const purchaseOrderService = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            docNo: 'P202607080002',
          },
        ],
      }),
    };
    const service = new ShipmentBatchService(
      undefined,
      undefined,
      purchaseOrderService as never,
    );

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
      'SH202607080002',
    ]);
    expect(managerResult.items.map((item) => item.docNo)).toEqual([
      'SH202607080001',
      'SH202607080002',
      'SH202607080003',
    ]);
  });

  it('shows shipment batches to sales users as a shared module', async () => {
    const service = new ShipmentBatchService();

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
      'SH202607080001',
      'SH202607080002',
      'SH202607080003',
    ]);
  });

  it('filters shipment batches by visible sales orders for sales users', async () => {
    const salesOrderService = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            docNo: 'S202607080003',
          },
        ],
      }),
    };
    const service = new ShipmentBatchService(
      undefined,
      salesOrderService as never,
      undefined,
    );

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
      'SH202607080003',
    ]);
  });

  it('rejects shipment batch detail access outside visible sales orders', async () => {
    const deniedSalesOrderService = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            docNo: 'S202607080003',
          },
        ],
      }),
    };
    const allowedSalesOrderService = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            docNo: 'S202607080001',
          },
        ],
      }),
    };
    const deniedService = new ShipmentBatchService(
      undefined,
      deniedSalesOrderService as never,
      undefined,
    );
    const allowedService = new ShipmentBatchService(
      undefined,
      allowedSalesOrderService as never,
      undefined,
    );

    await expect(
      deniedService.getDetail(1, { role: 'sales', user: 'Zoe' }),
    ).rejects.toThrow('发货批次不存在');
    await expect(
      allowedService.getDetail(1, { role: 'sales', user: 'Zoe' }),
    ).resolves.toMatchObject({
      batchNo: 'SH202607080001',
    });
  });

  it('allows sales users to read shipment batches as a shared sales submodule', async () => {
    const service = new ShipmentBatchService();

    const list = await service.list(
      {
        page: 1,
        pageSize: 20,
        sortBy: 'docNo',
        sortOrder: 'asc',
      },
      { role: 'sales', user: 'Zoe' },
    );
    const detail = await service.getDetail(1, { role: 'sales', user: 'Zoe' });

    expect(list.items.map((item) => item.docNo)).toEqual([
      'SH202607080001',
      'SH202607080002',
      'SH202607080003',
    ]);
    expect(detail.batchNo).toBe('SH202607080001');
  });
});
