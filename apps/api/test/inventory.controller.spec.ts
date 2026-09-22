import { InventoryController } from '../src/inventory/inventory.controller';
import { InventoryService } from '../src/inventory/inventory.service';

describe('InventoryController', () => {
  it('lists balances and ledger rows', async () => {
    const service = {
      listBalances: jest.fn().mockResolvedValue({
        items: [{ sku: 'SKU-LED-001', onHandQty: 40, availableQty: 40 }],
        total: 1,
        page: 2,
        pageSize: 5,
      }),
      listLedger: jest.fn().mockResolvedValue({
        items: [{ movementType: 'stock_in_confirmed', quantityDelta: 40 }],
        total: 1,
        page: 3,
        pageSize: 5,
      }),
    } as unknown as InventoryService;

    const controller = new InventoryController(service);

    await expect(
      controller.listBalances({
        page: '2',
        pageSize: '5',
      }),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ sku: 'SKU-LED-001' })],
    });
    await expect(
      controller.listLedger({
        page: '3',
        pageSize: '5',
      }),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ movementType: 'stock_in_confirmed' })],
    });
    expect(service.listBalances).toHaveBeenCalledWith({ page: 2, pageSize: 5 });
    expect(service.listLedger).toHaveBeenCalledWith({ page: 3, pageSize: 5 });
  });
});
