import { BadRequestException } from '@nestjs/common';
import { StockOutService } from '../src/stock-out/stock-out.service';

describe('StockOutService inventory guard', () => {
  it('persists a compact generated outbound number in Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const prismaMock = {
      businessDocument: {
        create: jest.fn().mockResolvedValue({ id: 701n, docNo: 'PENDING-STOCK-OUT-701' }),
        update: jest.fn().mockResolvedValue({ id: 701n }),
      },
    };
    const service = new StockOutService(prismaMock as any);
    const created = await service.create({
      sourceBizType: 'sales_order',
      sourceBizId: 88,
      warehouseId: 1,
      locationId: 11,
      createdBy: 2001,
      items: [{ productId: 1, quantity: 1 }],
    });

    expect(created.docNo).toMatch(/^SO\d{10}$/);
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 701n },
      data: { docNo: created.docNo },
    });
  });

  it('rejects confirmed outbound when available quantity is insufficient', async () => {
    const inventoryService = {
      assertAvailable: jest.fn().mockRejectedValue(
        new BadRequestException('Insufficient available inventory'),
      ),
    };

    const service = new StockOutService({} as any, inventoryService as any);

    await expect(
      service.confirmWithRecord({
        id: 701,
        docNo: 'SO202607140701',
        status: 'draft',
        warehouseId: 1,
        locationId: 11,
        createdBy: 2002,
        sourceBizType: 'sales_order',
        sourceBizId: 88,
        sourceDocNo: 'S202607080088',
        items: [{ productId: 1, quantity: 1000 }],
      }),
    ).rejects.toThrow('Insufficient available inventory');
  });

  it('lists, reads, and confirms stock-out documents from Prisma storage', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 701n,
            bizType: 'stock_out',
            docNo: 'SO202607140701',
            status: 'draft',
            createdAt: new Date('2026-07-14T10:00:00.000Z'),
            updatedAt: new Date('2026-07-14T10:05:00.000Z'),
            payload: {
              sourceBizType: 'sales_order',
              sourceBizId: 88,
              sourceDocNo: 'S202607080088',
              warehouseId: 1,
              locationId: 11,
              createdBy: 2002,
              items: [{ productId: 1, quantity: 10 }],
            },
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 701n,
          bizType: 'stock_out',
          docNo: 'SO202607140701',
          status: 'draft',
          createdAt: new Date('2026-07-14T10:00:00.000Z'),
          updatedAt: new Date('2026-07-14T10:05:00.000Z'),
          payload: {
            sourceBizType: 'sales_order',
            sourceBizId: 88,
            sourceDocNo: 'S202607080088',
            warehouseId: 1,
            locationId: 11,
            createdBy: 2002,
            items: [{ productId: 1, quantity: 10 }],
          },
        }),
        update: jest.fn().mockResolvedValue({
          id: 701n,
          bizType: 'stock_out',
          docNo: 'SO202607140701',
          status: 'confirmed',
          createdAt: new Date('2026-07-14T10:00:00.000Z'),
          updatedAt: new Date('2026-07-14T10:15:00.000Z'),
          payload: {
            sourceBizType: 'sales_order',
            sourceBizId: 88,
            sourceDocNo: 'S202607080088',
            warehouseId: 1,
            locationId: 11,
            createdBy: 2002,
            items: [{ productId: 1, quantity: 10 }],
          },
        }),
      },
    };
    const inventoryService = {
      assertAvailable: jest.fn().mockResolvedValue(undefined),
      postOutbound: jest.fn().mockResolvedValue(undefined),
    };

    const service = new StockOutService(prismaMock as any, inventoryService as any);

    await expect(service.list()).resolves.toMatchObject({
      items: [expect.objectContaining({ docNo: 'SO202607140701' })],
    });
    await expect(service.detail(701)).resolves.toMatchObject({
      docNo: 'SO202607140701',
      sourceDocNo: 'S202607080088',
    });
    await expect(service.confirm(701)).resolves.toMatchObject({
      status: 'confirmed',
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalled();
    expect(inventoryService.assertAvailable).toHaveBeenCalled();
    expect(inventoryService.postOutbound).toHaveBeenCalled();
  });

  it('paginates stock-out documents from Prisma storage', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';

    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 701n,
            bizType: 'stock_out',
            docNo: 'SO202607140701',
            status: 'draft',
            createdAt: new Date('2026-07-14T10:00:00.000Z'),
            updatedAt: new Date('2026-07-14T10:05:00.000Z'),
            payload: {
              sourceBizType: 'sales_order',
              sourceBizId: 88,
              sourceDocNo: 'S202607080088',
              warehouseId: 1,
              locationId: 11,
              createdBy: 2002,
              items: [{ productId: 1, quantity: 10 }],
            },
          },
          {
            id: 702n,
            bizType: 'stock_out',
            docNo: 'SO202607140702',
            status: 'draft',
            createdAt: new Date('2026-07-14T10:01:00.000Z'),
            updatedAt: new Date('2026-07-14T10:06:00.000Z'),
            payload: {
              sourceBizType: 'sales_order',
              sourceBizId: 89,
              sourceDocNo: 'S202607080089',
              warehouseId: 1,
              locationId: 11,
              createdBy: 2002,
              items: [{ productId: 1, quantity: 9 }],
            },
          },
          {
            id: 703n,
            bizType: 'stock_out',
            docNo: 'SO202607140703',
            status: 'draft',
            createdAt: new Date('2026-07-14T10:02:00.000Z'),
            updatedAt: new Date('2026-07-14T10:07:00.000Z'),
            payload: {
              sourceBizType: 'sales_order',
              sourceBizId: 90,
              sourceDocNo: 'S202607080090',
              warehouseId: 1,
              locationId: 11,
              createdBy: 2002,
              items: [{ productId: 1, quantity: 8 }],
            },
          },
        ]),
      },
    };

    const service = new StockOutService(prismaMock as any, {} as any);
    const result = await service.list({ page: 2, pageSize: 2 });

    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.items.map((item) => item.docNo)).toEqual(['SO202607140703']);
  });
});
