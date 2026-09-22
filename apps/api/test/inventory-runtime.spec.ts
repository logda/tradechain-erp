import { BadRequestException } from '@nestjs/common';
import { InventoryService } from '../src/inventory/inventory.service';
import { StockInService } from '../src/stock-in/stock-in.service';
import { StockOutService } from '../src/stock-out/stock-out.service';

describe('Inventory runtime movements', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('updates balances and ledger when stock-in and stock-out documents are confirmed', async () => {
    delete process.env.ERP_STORAGE_MODE;

    const inventoryService = new InventoryService();
    const stockInService = new StockInService({} as any, inventoryService as any);
    const stockOutService = new StockOutService({} as any, inventoryService as any);
    const productId = 91001;

    const stockIn = await stockInService.create({
      sourceBizType: 'purchase_order',
      sourceBizId: 991001,
      sourceDocNo: 'P-TEST-INVENTORY-RUNTIME-001',
      sourceCurrentStatus: 'purchasing',
      warehouseId: 1,
      locationId: 11,
      createdBy: 9000,
      items: [
        {
          productId,
          sku: 'SKU-TEST-INVENTORY-RUNTIME-001',
          productName: '测试商品库存入出库001',
          quantity: 18,
        },
      ],
    });

    await stockInService.confirm(stockIn.id);

    await expect(inventoryService.listBalances()).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          productId,
          sku: 'SKU-TEST-INVENTORY-RUNTIME-001',
          onHandQty: 18,
          availableQty: 18,
        }),
      ]),
    });

    const stockOut = await stockOutService.create({
      sourceBizType: 'sales_order',
      sourceBizId: 881001,
      sourceDocNo: 'S-TEST-INVENTORY-RUNTIME-001',
      warehouseId: 1,
      locationId: 11,
      createdBy: 9000,
      items: [{ productId, quantity: 7 }],
    });

    await stockOutService.confirm(stockOut.id);

    await expect(inventoryService.listBalances()).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          productId,
          onHandQty: 11,
          availableQty: 11,
        }),
      ]),
    });
    await expect(inventoryService.listLedger()).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          movementType: 'stock_in_confirmed',
          sourceDocNo: 'P-TEST-INVENTORY-RUNTIME-001',
          productId,
          quantityDelta: 18,
        }),
        expect.objectContaining({
          movementType: 'stock_out_confirmed',
          sourceDocNo: 'S-TEST-INVENTORY-RUNTIME-001',
          productId,
          quantityDelta: -7,
        }),
      ]),
    });
  });

  it('rejects runtime stock-out when available inventory is insufficient', async () => {
    delete process.env.ERP_STORAGE_MODE;

    const inventoryService = new InventoryService();

    await expect(
      inventoryService.assertAvailable(1, 11, [
        { productId: 91002, quantity: 1 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
