import { QuoteService } from '../src/quote/quote.service';

describe('QuoteService operational flow', () => {
  it('returns the created quote detail fields after draft creation', async () => {
    const service = new QuoteService();

    const created = await service.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
        },
      ],
    });
    const detail = await service.getDetail(created.id);

    expect(created.status).toBe('draft');
    expect(detail.id).toBe(created.id);
    expect(detail.customerId).toBe(1001);
    expect(detail.salesUserId).toBe(2001);
    expect(detail.sourceCode).toBe('expo');
    expect(detail.requirements).toBe('Need 500 units');
    expect(detail.items).toEqual([
      {
        lineNo: 1,
        productSource: 'existing',
        productId: 1,
        productCategory: 'electronics',
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        quantity: 500,
        salePrice: 15.9,
        amount: 7950,
        imageUrls: [],
      },
    ]);
  });

  it('maps formal sales user ids to the correct sales owner name', async () => {
    const service = new QuoteService();

    const created = await service.create({
      customerId: 1001,
      salesUserId: 3,
      sourceCode: 'formal-test',
      requirements: 'Formal user id mapping',
      items: [],
    });

    expect(created.salesUserName).toBe('Zoe');
  });

  it('keeps created quote state isolated per service instance', async () => {
    const firstService = new QuoteService();
    const secondService = new QuoteService();

    const firstCreated = await firstService.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
      items: [],
    });
    const secondCreated = await secondService.create({
      customerId: 3001,
      salesUserId: 4001,
      sourceCode: 'website',
      requirements: 'Need 200 units',
      items: [],
    });

    expect(firstCreated.id).toBe(100);
    expect(secondCreated.id).toBe(100);
    await expect(firstService.getDetail(secondCreated.id)).resolves.toMatchObject({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
    });
  });
});
