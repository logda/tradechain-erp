import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QuoteService, type QuoteDetailRecord } from '../src/quote/quote.service';
import { resolveQuoteStore } from '../src/quote/quote.store';
import type { PrismaService } from '../src/storage/prisma.service';

describe.each(['runtime', 'prisma'])('quote list item snapshots (%s)', (mode) => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'erp-quote-list-items-'));
    process.env.ERP_DATA_DIR = dataDir;
    process.env.ERP_STORAGE_MODE = mode;
  });

  afterEach(() => {
    delete process.env.ERP_DATA_DIR;
    delete process.env.ERP_STORAGE_MODE;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('returns paired historical products and quantities without procurement details or other owners', async () => {
    const quote: QuoteDetailRecord = {
      id: 810,
      quoteNo: 'XQ-SNAPSHOT-810',
      documentType: 'demand',
      productSource: 'existing',
      status: 'pending_boss_approval',
      currentVersionNo: 1,
      customerId: 0,
      customerName: '手填客户',
      salesUserId: 2001,
      salesUserName: 'Zoe',
      sourceCode: 'website',
      requirements: '保留历史名称与逐行数量',
      createdAt: '2026-09-24T01:00:00.000Z',
      items: [
        { lineNo: 1, productId: 1, sku: 'OLD-1', productName: '历史风扇名称', quantity: 12, unit: '个', salePrice: 40, amount: 480, confirmedSupplierName: '保密供应商', confirmedPurchasePrice: 20 },
        { lineNo: 2, productId: 2, sku: 'OLD-2', productName: '历史灯具名称', quantity: 3.5, unit: '箱', salePrice: 80, amount: 280 },
      ],
    };
    const otherQuote = { ...quote, id: 811, quoteNo: 'XQ-SNAPSHOT-811', salesUserId: 2002, salesUserName: 'Leo' };
    resolveQuoteStore().upsertQuote(quote);
    resolveQuoteStore().upsertQuote(otherQuote);
    const prisma = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([quote, otherQuote].map((record) => ({
          id: BigInt(record.id), bizType: 'quote', docNo: record.quoteNo,
          status: record.status, payload: record,
          createdAt: new Date(record.createdAt), updatedAt: new Date(record.createdAt),
        }))),
      },
    } as unknown as PrismaService;
    const service = new QuoteService(mode === 'prisma' ? prisma : undefined);

    const result = await service.list({ keyword: 'XQ-SNAPSHOT' }, { role: 'sales', user: 'Zoe' });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ docNo: 'XQ-SNAPSHOT-810', items: [
      { lineNo: 1, productName: '历史风扇名称', quantity: 12, unit: '个' },
      { lineNo: 2, productName: '历史灯具名称', quantity: 3.5, unit: '箱' },
    ] });
    expect(JSON.stringify(result)).not.toContain('保密供应商');
    expect(JSON.stringify(result)).not.toContain('confirmedPurchasePrice');
    expect(JSON.stringify(result)).not.toContain('salePrice');
  });
});
