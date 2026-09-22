import { WarehouseService } from '../src/warehouse/warehouse.service';

describe('WarehouseService prisma storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('reads active warehouses from Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      warehouse: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            code: 'WH-MAIN',
            name: 'Main Warehouse',
            status: 'active',
            ownerName: 'Leo',
            updatedAt: new Date('2026-07-14T08:00:00.000Z'),
          },
        ]),
      },
      warehouseLocation: {
        findMany: jest.fn().mockResolvedValue([{ id: 11n }, { id: 12n }]),
      },
    };

    const service = new WarehouseService(prismaMock as any);
    const result = await service.list();

    expect(result.items[0]).toMatchObject({ code: 'WH-MAIN', locationCount: 2 });
  });

  it('paginates warehouse rows from Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      warehouse: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            code: 'WH-A',
            name: 'Warehouse A',
            status: 'active',
            ownerName: 'Leo',
            updatedAt: new Date('2026-07-14T08:00:00.000Z'),
          },
          {
            id: 2n,
            code: 'WH-B',
            name: 'Warehouse B',
            status: 'active',
            ownerName: 'Leo',
            updatedAt: new Date('2026-07-14T08:05:00.000Z'),
          },
          {
            id: 3n,
            code: 'WH-C',
            name: 'Warehouse C',
            status: 'active',
            ownerName: 'Leo',
            updatedAt: new Date('2026-07-14T08:10:00.000Z'),
          },
        ]),
      },
      warehouseLocation: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ id: 11n }])
          .mockResolvedValueOnce([{ id: 12n }])
          .mockResolvedValueOnce([{ id: 13n }]),
      },
    };

    const service = new WarehouseService(prismaMock as any);
    const result = await service.list({ page: 2, pageSize: 2 });

    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.items.map((item) => item.code)).toEqual(['WH-C']);
  });
});
