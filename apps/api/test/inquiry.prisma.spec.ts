import { InquiryService } from '../src/inquiry/inquiry.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('InquiryService prisma document storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('lists inquiry snapshots from Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T13:00:00.000Z');
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 201n,
            bizType: 'quote_inquiry',
            docNo: 'IQ202607080201',
            status: 'pending_boss_review',
            ownerUserId: 2001n,
            counterpartyId: 1001n,
            payload: {
              id: 201,
              inquiryNo: 'IQ202607080201',
              status: 'pending_boss_review',
              quoteOrderId: 1,
              quoteOrderNo: 'Q202607080001',
              quoteVersionNo: 1,
              customerName: 'Acme Trading',
              createdBy: 'Zoe',
              supplierCount: 2,
              comparisonSummary: '已收齐 2 家供应商报价，等待老板确认。',
              createdAt: createdAt.toISOString(),
              detailHref: '/app/sales/inquiries/201',
              items: [],
            },
            createdBy: 2001n,
            createdAt,
            updatedAt: createdAt,
          },
        ]),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new InquiryService(prisma);
    const result = await service.list({
      keyword: 'Acme',
      status: 'pending_boss_review',
      page: 1,
      pageSize: 20,
    });

    expect(prismaMock.businessDocument.findMany).toHaveBeenCalledWith({
      where: { bizType: 'quote_inquiry' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      inquiryNo: 'IQ202607080201',
      status: 'pending_boss_review',
      customerName: 'Acme Trading',
    });
  });

  it('hydrates inquiry item images from the source quote when the inquiry payload omits them', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const inquiryCreatedAt = new Date('2026-07-13T13:05:00.000Z');
    const quoteCreatedAt = new Date('2026-07-13T12:45:00.000Z');
    const prismaMock = {
      businessDocument: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 202n,
            bizType: 'quote_inquiry',
            docNo: 'IQ202607080202',
            status: 'pending_inquiry',
            ownerUserId: 2001n,
            counterpartyId: 1001n,
            payload: {
              id: 202,
              inquiryNo: 'IQ202607080202',
              status: 'pending_inquiry',
              sourceQuoteId: 101,
              quoteOrderId: 101,
              quoteOrderNo: 'Q202607080101',
              quoteVersionNo: 1,
              customerName: 'Acme Trading',
              createdBy: 'Zoe',
              supplierCount: 0,
              comparisonSummary: '已由报价单生成，等待采购询价。',
              createdAt: inquiryCreatedAt.toISOString(),
              detailHref: '/app/sales/inquiries/202',
              items: [
                {
                  itemId: 1,
                  lineNo: 1,
                  sku: 'SKU-LED-001',
                  productName: '智能 LED 灯带',
                  imageUrls: [],
                  requiredSupplierCount: 2,
                  supplierQuotes: [],
                  confirmedSalePrice: 0,
                },
              ],
            },
            createdBy: 2001n,
            createdAt: inquiryCreatedAt,
            updatedAt: inquiryCreatedAt,
          },
        ]),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === 202n) {
            return {
              id: 202n,
              bizType: 'quote_inquiry',
              docNo: 'IQ202607080202',
              status: 'pending_inquiry',
              ownerUserId: 2001n,
              counterpartyId: 1001n,
              payload: {
                id: 202,
                inquiryNo: 'IQ202607080202',
                status: 'pending_inquiry',
                sourceQuoteId: 101,
                quoteOrderId: 101,
                quoteOrderNo: 'Q202607080101',
                quoteVersionNo: 1,
                customerName: 'Acme Trading',
                createdBy: 'Zoe',
                supplierCount: 0,
                comparisonSummary: '已由报价单生成，等待采购询价。',
                createdAt: inquiryCreatedAt.toISOString(),
                detailHref: '/app/sales/inquiries/202',
                items: [
                  {
                    itemId: 1,
                    lineNo: 1,
                    sku: 'SKU-LED-001',
                    productName: '智能 LED 灯带',
                    imageUrls: [],
                    requiredSupplierCount: 2,
                    supplierQuotes: [],
                    confirmedSalePrice: 0,
                  },
                ],
              },
              createdBy: 2001n,
              createdAt: inquiryCreatedAt,
              updatedAt: inquiryCreatedAt,
            };
          }

          if (where.id === 101n) {
            return {
              id: 101n,
              bizType: 'quote',
              docNo: 'Q202607080101',
              status: 'submitted',
              ownerUserId: 2001n,
              counterpartyId: 1001n,
              payload: {
                id: 101,
                quoteNo: 'Q202607080101',
                status: 'submitted',
                currentVersionNo: 1,
                customerId: 1001,
                customerName: 'Acme Trading',
                salesUserId: 2001,
                sourceCode: 'expo',
                inquiryDate: '2026-07-13',
                requirements: 'Need 1000 units',
                submitMode: 'submit',
                createdAt: quoteCreatedAt.toISOString(),
                items: [
                  {
                    lineNo: 1,
                    productId: 1,
                    sku: 'SKU-LED-001',
                    productName: '智能 LED 灯带',
                    unit: 'set',
                    quantity: 1000,
                    salePrice: 15.9,
                    amount: 15900,
                    imageUrls: [
                      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/led.png',
                    ],
                  },
                ],
              },
              createdBy: 2001n,
              createdAt: quoteCreatedAt,
              updatedAt: quoteCreatedAt,
            };
          }

          return null;
        }),
      },
      operationLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new InquiryService(prisma);
    const result = await service.getById(202);

    expect(result.items[0]).toMatchObject({
      lineNo: 1,
      imageUrls: [
        'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/led.png',
      ],
    });
  });

  it('updates inquiry status when submitting for comparison and boss confirming', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T13:30:00.000Z');
    let quoteStatus = 'submitted';
    let quotePayload = {
      id: 2,
      quoteNo: 'Q202607080002',
      status: 'submitted',
      currentVersionNo: 2,
      customerId: 1001,
      customerName: 'Bravo Retail',
      salesUserId: 2001,
      sourceCode: 'tiktok',
      requirements: '等待提交比价。',
      submitMode: 'submit',
      currentProgress: '待询价',
      linkedInquiryId: 202,
      linkedInquiryNo: 'IQ202607080202',
      linkedInquiryStatus: 'pending_inquiry',
      createdAt: createdAt.toISOString(),
      items: [
        {
          lineNo: 1,
          productId: 10,
          sku: 'SKU-PLUG-001',
          productName: '多孔插座',
          unit: 'pcs',
          quantity: 1,
          salePrice: 4.8,
          amount: 4.8,
        },
      ],
    };
    let inquiryStatus = 'pending_inquiry';
    let inquiryPayload = {
      id: 202,
      inquiryNo: 'IQ202607080202',
      status: 'pending_inquiry',
      quoteOrderId: 2,
      quoteOrderNo: 'Q202607080002',
      quoteVersionNo: 2,
      customerName: 'Bravo Retail',
      createdBy: 'Leo',
      supplierCount: 2,
      comparisonSummary: '等待提交比价。',
      createdAt: createdAt.toISOString(),
      detailHref: '/app/sales/inquiries/202',
      items: [
        {
          itemId: 10,
          lineNo: 1,
          sku: 'SKU-PLUG-001',
          productName: '多孔插座',
          imageUrls: [],
          requiredSupplierCount: 2,
          supplierQuotes: [],
          confirmedSalePrice: 0,
        },
      ],
    };
    const prismaMock = {
      businessDocument: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === 2n) {
            return {
              id: 2n,
              bizType: 'quote',
              docNo: 'Q202607080002',
              status: quoteStatus,
              ownerUserId: 2001n,
              counterpartyId: 1001n,
              payload: quotePayload,
              createdBy: 2001n,
              createdAt,
              updatedAt: createdAt,
            };
          }

          return {
            id: 202n,
            bizType: 'quote_inquiry',
            docNo: 'IQ202607080202',
            status: inquiryStatus,
            ownerUserId: 2001n,
            counterpartyId: 1001n,
            payload: inquiryPayload,
            createdBy: 2001n,
            createdAt,
            updatedAt: createdAt,
          };
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          if (where.id === 2n) {
            quoteStatus = data.status;
            quotePayload = data.payload;

            return {
              id: 2n,
              bizType: 'quote',
              docNo: 'Q202607080002',
              status: quoteStatus,
              ownerUserId: 2001n,
              counterpartyId: 1001n,
              payload: quotePayload,
              createdBy: 2001n,
              createdAt,
              updatedAt: createdAt,
            };
          }

          inquiryStatus = data.status;
          inquiryPayload = data.payload;

          return {
            id: 202n,
            bizType: 'quote_inquiry',
            docNo: 'IQ202607080202',
            status: inquiryStatus,
            ownerUserId: 2001n,
            counterpartyId: 1001n,
            payload: inquiryPayload,
            createdBy: 2001n,
            createdAt,
            updatedAt: createdAt,
          };
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 1n }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new InquiryService(prisma);
    const submitted = await service.submitForComparison({
      inquiryId: 202,
      items: [
        {
          itemId: 10,
          supplierQuotes: [
            {
              supplierSourceMode: 'counterparty',
              supplierId: 2,
              supplierCode: 'SUP-BRAVO',
              supplierName: 'Bravo Industrial',
              purchasePrice: 18.6,
            },
            {
              supplierSourceMode: 'manual',
              supplierName: '深圳快联电子',
              purchasePrice: 19.2,
            },
          ],
        },
      ],
    });
    const confirmed = await service.confirmByBoss({
      inquiryId: 202,
      items: [
        {
          itemId: 10,
          supplierQuoteCount: 2,
          confirmedSalePrice: 12.5,
          selectedSupplierQuoteIndex: 0,
        },
      ],
    });

    expect(prismaMock.businessDocument.findUnique).toHaveBeenCalledWith({
      where: { id: 202n },
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 202n },
      data: expect.objectContaining({
        status: 'boss_confirmed',
        payload: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              itemId: 10,
              confirmedSalePrice: 12.5,
            }),
          ]),
        }),
      }),
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 2n },
      data: expect.objectContaining({
        status: 'boss_confirmed',
        payload: expect.objectContaining({
          status: 'boss_confirmed',
          currentProgress: '老板已确认',
          linkedInquiryStatus: 'boss_confirmed',
          items: expect.arrayContaining([
            expect.objectContaining({
              lineNo: 1,
              confirmedSalePrice: 12.5,
            }),
          ]),
        }),
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'quote_inquiry',
        bizId: 202n,
        operationType: 'submit_inquiry_for_comparison',
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'quote_inquiry',
        bizId: 202n,
        operationType: 'boss_confirm_inquiry',
      }),
    });
    expect(submitted.status).toBe('pending_boss_review');
    expect(confirmed.status).toBe('boss_confirmed');
  });
});
