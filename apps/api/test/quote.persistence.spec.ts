import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QuoteService } from '../src/quote/quote.service';

describe('QuoteService persistence', () => {
  let runtimeDir: string;

  beforeEach(() => {
    runtimeDir = mkdtempSync(join(tmpdir(), 'erp-api-quote-'));
    process.env.ERP_DATA_DIR = runtimeDir;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    rmSync(runtimeDir, { recursive: true, force: true });
  });

  it('persists created quote details across service instances', async () => {
    const firstService = new QuoteService();
    const created = await firstService.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 800 units with custom packaging',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 800,
          salePrice: 15.9,
        },
      ],
    });

    const secondService = new QuoteService();
    const detail = await secondService.getDetail(created.id);

    expect(detail).toMatchObject({
      id: created.id,
      quoteNo: created.quoteNo,
      customerId: 1001,
      salesUserId: 2001,
      requirements: 'Need 800 units with custom packaging',
    });
    expect(detail.items).toHaveLength(1);
  });
});
