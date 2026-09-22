import { InventoryService } from '../src/inventory/inventory.service';

describe('InventoryService prisma queries', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('projects balances and ledger rows from Prisma tables', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            productId: 1n,
            warehouseId: 1n,
            locationId: 11n,
            onHandQty: 40,
            availableQty: 40,
            updatedAt: new Date('2026-07-14T08:30:00.000Z'),
          },
        ]),
      },
      inventoryLedger: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            movementType: 'stock_in_confirmed',
            sourceBizType: 'purchase_order',
            sourceBizId: 100n,
            sourceDocNo: 'P202607110100',
            productId: 1n,
            warehouseId: 1n,
            locationId: 11n,
            quantityDelta: 40,
            createdBy: 'leo',
            createdAt: new Date('2026-07-14T08:30:00.000Z'),
          },
        ]),
      },
    };

    const service = new InventoryService(prismaMock as any);
    await expect(service.listBalances()).resolves.toMatchObject({
      items: [expect.objectContaining({ onHandQty: 40 })],
    });
    await expect(service.listLedger()).resolves.toMatchObject({
      items: [expect.objectContaining({ movementType: 'stock_in_confirmed' })],
    });
  });

  it('paginates balances and ledger rows from Prisma tables', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      inventoryBalance: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            productId: 1n,
            warehouseId: 1n,
            locationId: 11n,
            onHandQty: 40,
            availableQty: 40,
            updatedAt: new Date('2026-07-14T08:30:00.000Z'),
          },
          {
            id: 2n,
            productId: 2n,
            warehouseId: 1n,
            locationId: 12n,
            onHandQty: 20,
            availableQty: 18,
            updatedAt: new Date('2026-07-14T08:35:00.000Z'),
          },
          {
            id: 3n,
            productId: 3n,
            warehouseId: 1n,
            locationId: 13n,
            onHandQty: 10,
            availableQty: 8,
            updatedAt: new Date('2026-07-14T08:40:00.000Z'),
          },
        ]),
      },
      inventoryLedger: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            movementType: 'stock_in_confirmed',
            sourceBizType: 'purchase_order',
            sourceBizId: 100n,
            sourceDocNo: 'P202607110100',
            productId: 1n,
            warehouseId: 1n,
            locationId: 11n,
            quantityDelta: 40,
            createdBy: 'leo',
            createdAt: new Date('2026-07-14T08:30:00.000Z'),
          },
          {
            id: 2n,
            movementType: 'stock_out_confirmed',
            sourceBizType: 'sales_order',
            sourceBizId: 101n,
            sourceDocNo: 'S202607110101',
            productId: 2n,
            warehouseId: 1n,
            locationId: 12n,
            quantityDelta: -5,
            createdBy: 'leo',
            createdAt: new Date('2026-07-14T08:35:00.000Z'),
          },
          {
            id: 3n,
            movementType: 'manual_adjust_increase',
            sourceBizType: 'inventory',
            sourceBizId: 102n,
            sourceDocNo: 'ADJ202607110102',
            productId: 3n,
            warehouseId: 1n,
            locationId: 13n,
            quantityDelta: 2,
            createdBy: 'leo',
            createdAt: new Date('2026-07-14T08:40:00.000Z'),
          },
        ]),
      },
    };

    const service = new InventoryService(prismaMock as any);
    const balances = await service.listBalances({ page: 2, pageSize: 2 });
    const ledger = await service.listLedger({ page: 2, pageSize: 2 });

    expect(balances.total).toBe(3);
    expect(balances.items.map((item) => item.productId)).toEqual([3]);
    expect(ledger.total).toBe(3);
    expect(ledger.items.map((item) => item.id)).toEqual([3]);
  });
});
