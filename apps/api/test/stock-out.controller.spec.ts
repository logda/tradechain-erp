import { StockOutController } from '../src/stock-out/stock-out.controller';
import { StockOutService } from '../src/stock-out/stock-out.service';

describe('StockOutController', () => {
  it('confirms outbound only when inventory is available', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({
        items: [{ id: 701, docNo: 'SO202607140701', status: 'draft' }],
        total: 1,
        page: 2,
        pageSize: 5,
      }),
      detail: jest.fn().mockResolvedValue({
        id: 701,
        docNo: 'SO202607140701',
        status: 'draft',
      }),
      create: jest.fn().mockResolvedValue({
        id: 701,
        docNo: 'SO202607140701',
        status: 'draft',
      }),
      confirm: jest.fn().mockResolvedValue({
        id: 701,
        docNo: 'SO202607140701',
        status: 'confirmed',
      }),
    } as unknown as StockOutService;

    const controller = new StockOutController(service);

    await expect(
      controller.list({
        page: '2',
        pageSize: '5',
      }),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ docNo: 'SO202607140701' })],
    });
    expect(service.list).toHaveBeenCalledWith({ page: 2, pageSize: 5 });
    await expect(controller.detail(701)).resolves.toMatchObject({
      docNo: 'SO202607140701',
    });

    await expect(
      controller.create({
        sourceBizType: 'sales_order',
        sourceBizId: 88,
        warehouseId: 1,
        locationId: 11,
        createdBy: 2002,
        items: [{ productId: 1, quantity: 10 }],
      }),
    ).resolves.toMatchObject({ status: 'draft' });

    await expect(controller.confirm(701)).resolves.toMatchObject({
      status: 'confirmed',
    });
  });
});
