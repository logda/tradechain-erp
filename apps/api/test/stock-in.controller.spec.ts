import { StockInController } from '../src/stock-in/stock-in.controller';
import { StockInService } from '../src/stock-in/stock-in.service';

describe('StockInController', () => {
  it('creates and confirms stock-in orders', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({
        items: [{ id: 601, docNo: 'SI202607140601', status: 'draft' }],
        total: 1,
        page: 2,
        pageSize: 5,
      }),
      detail: jest.fn().mockResolvedValue({
        id: 601,
        docNo: 'SI202607140601',
        status: 'draft',
      }),
      create: jest.fn().mockResolvedValue({ id: 601, docNo: 'SI202607140601', status: 'draft' }),
      confirm: jest.fn().mockResolvedValue({
        id: 601,
        docNo: 'SI202607140601',
        status: 'confirmed',
      }),
    } as unknown as StockInService;

    const controller = new StockInController(service);

    await expect(
      controller.list({
        page: '2',
        pageSize: '5',
      }),
    ).resolves.toMatchObject({
      items: [expect.objectContaining({ docNo: 'SI202607140601' })],
    });
    expect(service.list).toHaveBeenCalledWith({ page: 2, pageSize: 5 });
    await expect(controller.detail(601)).resolves.toMatchObject({
      docNo: 'SI202607140601',
    });

    await expect(
      controller.create({
        sourceBizType: 'purchase_order',
        sourceBizId: 100,
        sourceCurrentStatus: 'purchasing',
        warehouseId: 1,
        locationId: 11,
        createdBy: 2002,
        items: [{ productId: 1, quantity: 40 }],
      }),
    ).resolves.toMatchObject({ status: 'draft' });

    await expect(controller.confirm(601)).resolves.toMatchObject({
      status: 'confirmed',
    });
  });
});
