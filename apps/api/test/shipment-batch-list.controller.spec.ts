import { Test } from '@nestjs/testing';
import { ShipmentBatchController } from '../src/shipment-batch/shipment-batch.controller';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';

describe('ShipmentBatchController list', () => {
  it('normalizes list query params before forwarding them', async () => {
    const list = jest.fn().mockResolvedValue({
      items: [],
      page: 2,
      pageSize: 5,
      total: 0,
      appliedFilters: {},
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [ShipmentBatchController],
      providers: [{ provide: ShipmentBatchService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(ShipmentBatchController);
    const result = await controller.list({
      keyword: 'Acme',
      receiptSendStatus: 'sent',
      hasException: 'yes',
      purchaseOrderNo: 'P202607080001',
      page: '2',
      pageSize: '5',
      sortBy: 'docNo',
      sortOrder: 'asc',
    });

    expect(list).toHaveBeenCalledWith({
      keyword: 'Acme',
      receiptSendStatus: 'sent',
      hasException: 'yes',
      purchaseOrderNo: 'P202607080001',
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
      controllers: [ShipmentBatchController],
      providers: [{ provide: ShipmentBatchService, useValue: { list } }],
    }).compile();

    const controller = moduleRef.get(ShipmentBatchController);
    await controller.list({
      hasException: 'bogus' as 'all',
      page: 'NaN',
      pageSize: '0',
      sortBy: 'bogus',
    });

    expect(list).toHaveBeenCalledWith({
      hasException: 'all',
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }, undefined);
  });
});
