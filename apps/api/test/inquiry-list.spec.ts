import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InquiryService } from '../src/inquiry/inquiry.service';

describe('InquiryService list', () => {
  const previousStorageMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (previousStorageMode == null) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = previousStorageMode;
    }
  });

  it('returns inquiry detail by id', async () => {
    const service = new InquiryService();

    const result = await service.getById(2);

    expect(result).toMatchObject({
      id: 2,
      inquiryNo: 'IQ202607080002',
      quoteOrderNo: 'Q202607080002',
      status: 'pending_boss_review',
    });
  });

  it('filters inquiries by advanced fields and returns applied filters', async () => {
    const service = new InquiryService();

    const result = await service.list({
      keyword: 'Acme',
      customerName: 'Acme',
      createdBy: 'Zoe',
      status: 'boss_confirmed',
      page: 1,
      pageSize: 10,
    });

    expect(result.items.map((item) => item.inquiryNo)).toEqual([
      'IQ202607080003',
    ]);
    expect(result.items[0]?.customerFullName).toBe('星河贸易');
    expect(result.appliedFilters.status).toBe('boss_confirmed');
    expect(result.total).toBe(1);
  });

  it('filters by shared status and paginates', async () => {
    const service = new InquiryService();

    const result = await service.list({
      status: 'pending_boss_review',
      page: 1,
      pageSize: 1,
    });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
  });

  it('filters inquiries by source quote number', async () => {
    const service = new InquiryService();

    const result = await service.list({
      quoteNo: 'Q202607080002',
      page: 1,
      pageSize: 20,
    });

    expect(result.items.map((item) => item.inquiryNo)).toEqual([
      'IQ202607080002',
    ]);
    expect(result.appliedFilters.quoteNo).toBe('Q202607080002');
  });

  it('lets purchase users and purchase managers see the inquiry work pool', async () => {
    const service = new InquiryService();

    const purchaseUserResult = await service.list(
      {
        page: 1,
        pageSize: 20,
      },
      { role: 'purchase', user: 'Leo' },
    );
    const purchaseManagerResult = await service.list(
      {
        page: 1,
        pageSize: 20,
      },
      { role: 'purchase_manager', user: 'Mia' },
    );

    expect(purchaseUserResult.items.map((item) => item.inquiryNo)).toEqual([
      'IQ202607080001',
      'IQ202607080002',
      'IQ202607080003',
    ]);
    expect(purchaseManagerResult.items.map((item) => item.inquiryNo)).toEqual([
      'IQ202607080001',
      'IQ202607080002',
      'IQ202607080003',
    ]);
  });

  it('does not hide sales-created inquiries from purchase users', async () => {
    const service = new InquiryService();

    const result = await service.list(
      {
        page: 1,
        pageSize: 20,
      },
      { role: 'purchase', user: 'Leo' },
    );

    expect(result.items.map((item) => item.inquiryNo)).toEqual([
      'IQ202607080001',
      'IQ202607080002',
      'IQ202607080003',
    ]);
    expect(result.items.map((item) => item.createdBy)).toEqual([
      'Zoe',
      'Leo',
      'Zoe',
    ]);
  });

  it('hides boss-confirmed sale prices from purchase responses', async () => {
    const service = new InquiryService();

    const purchaseDetail = await service.getById(3, {
      role: 'purchase',
      user: 'Leo',
    });
    const purchaseList = await service.list(
      { page: 1, pageSize: 20 },
      { role: 'purchase_manager', user: 'Mia' },
    );
    const bossDetail = await service.getById(3, {
      role: 'boss',
      user: 'Mia',
    });

    expect(purchaseDetail.items[0]).not.toHaveProperty('confirmedSalePrice');
    expect(
      purchaseList.items.find((item) => item.id === 3)?.items[0],
    ).not.toHaveProperty('confirmedSalePrice');
    expect(bossDetail.items[0]).toHaveProperty('confirmedSalePrice', 56.2);
  });

  it('normalizes empty prisma audit operators so inquiry log pages can render', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const service = new InquiryService({
      operationLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            bizType: 'quote_inquiry',
            bizId: 2n,
            operationType: 'submit_inquiry',
            operatorId: null,
            beforeData: null,
            afterData: { status: 'pending_boss_review' },
            createdAt: new Date('2026-07-08T09:00:00.000Z'),
          },
        ]),
      },
    } as never);

    await expect(service.listAuditLogs()).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          operatorId: 0,
        }),
      ],
    });
  });

  it('normalizes empty runtime audit operators from persisted audit logs', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'erp-inquiry-audit-'));
    const previousDataDir = process.env.ERP_DATA_DIR;
    process.env.ERP_DATA_DIR = runtimeDir;
    mkdirSync(runtimeDir, { recursive: true });
    writeFileSync(
      join(runtimeDir, 'inquiry-runtime.json'),
      `${JSON.stringify(
        {
          inquiries: [],
          auditLogs: [
            {
              id: 1,
              bizType: 'quote_inquiry',
              bizId: 2,
              operationType: 'submit_inquiry',
              operatorId: null,
              beforeData: null,
              afterData: { status: 'pending_boss_review' },
              createdAt: '2026-07-08T09:00:00.000Z',
            },
          ],
          nextId: 100,
          nextAuditLogId: 2,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    try {
      const service = new InquiryService();

      await expect(service.listAuditLogs()).resolves.toMatchObject({
        items: [
          expect.objectContaining({
            operatorId: 0,
          }),
        ],
      });
    } finally {
      if (previousDataDir == null) {
        delete process.env.ERP_DATA_DIR;
      } else {
        process.env.ERP_DATA_DIR = previousDataDir;
      }
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });
});
