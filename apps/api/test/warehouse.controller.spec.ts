import { WarehouseController } from '../src/warehouse/warehouse.controller';
import { WarehouseService } from '../src/warehouse/warehouse.service';

describe('WarehouseController', () => {
  it('lists warehouses with location counts', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: 1,
            code: 'WH-MAIN',
            name: 'Main Warehouse',
            status: 'active',
            locationCount: 2,
            ownerName: 'Leo',
            updatedAt: '2026-07-14T08:00:00.000Z',
          },
        ],
      }),
    } as unknown as WarehouseService;

    const controller = new WarehouseController(service);

    await expect(
      controller.list({
        page: '2',
        pageSize: '5',
      }),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ code: 'WH-MAIN', locationCount: 2 })],
    });
    expect(service.list).toHaveBeenCalledWith({ page: 2, pageSize: 5 });
  });
});
