import { SampleOrderService } from '../src/sample-order/sample-order.service';
import type { PrismaService } from '../src/storage/prisma.service';

describe('SampleOrderService prisma document storage', () => {
  const originalMode = process.env.ERP_STORAGE_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.ERP_STORAGE_MODE;
    } else {
      process.env.ERP_STORAGE_MODE = originalMode;
    }
  });

  it('creates sample snapshots in Prisma and reads them back from list, detail, and versions', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T17:00:00.000Z');
    const prismaMock = {
      businessDocument: {
        create: jest.fn().mockResolvedValue({
          id: 601n,
          docNo: 'PENDING-SAMPLE-601',
          createdAt,
        }),
        update: jest.fn().mockResolvedValue({
          id: 601n,
          bizType: 'sample_order',
          docNo: 'SP202607110601',
          status: 'draft',
          ownerUserId: 2001n,
          counterpartyId: 1001n,
          payload: {
            id: 601,
            sampleNo: 'SP202607110601',
            currentVersionNo: 1,
            currentStatus: 'draft',
            sourceQuoteOrderId: 7,
            sourceQuoteVersionNo: 3,
            customerId: 1001,
            createdBy: 2001,
            createdAt: createdAt.toISOString(),
            sampleRequirements: 'Need gold-plated sample',
            samplingCost: 1200,
            customerName: 'Acme Trading',
            ownerName: 'Zoe',
            quoteNo: 'Q202607080007',
            isReplacement: false,
            isCancelled: false,
            title: 'Acme Trading 样品单',
            secondaryStatus: 'draft',
            versionHistory: [
              { versionNo: 1, status: 'draft', createdAt: createdAt.toISOString() },
            ],
          },
          createdBy: 2001n,
          createdAt,
          updatedAt: createdAt,
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 601n,
            bizType: 'sample_order',
            docNo: 'SP202607110601',
            status: 'draft',
            ownerUserId: 2001n,
            counterpartyId: 1001n,
            payload: {
              id: 601,
              sampleNo: 'SP202607110601',
              currentVersionNo: 1,
              currentStatus: 'draft',
              sourceQuoteOrderId: 7,
              sourceQuoteVersionNo: 3,
              customerId: 1001,
              createdBy: 2001,
              createdAt: createdAt.toISOString(),
              sampleRequirements: 'Need gold-plated sample',
              samplingCost: 1200,
              customerName: 'Acme Trading',
              ownerName: 'Zoe',
              quoteNo: 'Q202607080007',
              isReplacement: false,
              isCancelled: false,
              title: 'Acme Trading 样品单',
              secondaryStatus: 'draft',
              versionHistory: [
                {
                  versionNo: 1,
                  status: 'draft',
                  createdAt: createdAt.toISOString(),
                },
              ],
            },
            createdBy: 2001n,
            createdAt,
            updatedAt: createdAt,
          },
        ]),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === 7n) {
            return {
              id: 7n,
              bizType: 'quote',
              docNo: 'Q202607080007',
              status: 'boss_confirmed',
              ownerUserId: 2001n,
              counterpartyId: 1001n,
              payload: {
                id: 7,
                quoteNo: 'Q202607080007',
                status: 'boss_confirmed',
                currentVersionNo: 3,
                items: [
                  {
                    sku: 'SKU-LED-001',
                    productName: '智能 LED 灯带',
                    quantity: 500,
                    imageUrls: [
                      'http://127.0.0.1:3001/uploads/formal-quotes/led-source-front.png',
                      'http://127.0.0.1:3001/uploads/formal-quotes/led-source-side.png',
                    ],
                  },
                ],
              },
              createdBy: 2001n,
              createdAt,
              updatedAt: createdAt,
            };
          }

          return {
            id: 601n,
            bizType: 'sample_order',
            docNo: 'SP202607110601',
            status: 'draft',
            ownerUserId: 2001n,
            counterpartyId: 1001n,
            payload: {
              id: 601,
              sampleNo: 'SP202607110601',
              currentVersionNo: 1,
              currentStatus: 'draft',
              sourceQuoteOrderId: 7,
              sourceQuoteVersionNo: 3,
              customerId: 1001,
              createdBy: 2001,
              createdAt: createdAt.toISOString(),
              sampleRequirements: 'Need gold-plated sample',
              samplingCost: 1200,
              customerName: 'Acme Trading',
              ownerName: 'Zoe',
              quoteNo: 'Q202607080007',
              isReplacement: false,
              isCancelled: false,
              title: 'Acme Trading 样品单',
              secondaryStatus: 'draft',
              versionHistory: [
                {
                  versionNo: 1,
                  status: 'draft',
                  createdAt: createdAt.toISOString(),
                },
              ],
            },
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

    const service = new SampleOrderService(prisma);
    const created = await service.create({
      quoteOrderId: 7,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need gold-plated sample',
      samplingCost: 1200,
    });
    const listed = await service.list({
      keyword: 'Acme',
      customerName: 'Acme',
      ownerName: 'Zoe',
      quoteNo: 'Q202607080001',
      isReplacement: 'no',
      isCancelled: 'no',
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    const detail = await service.getDetail(601);
    const versions = await service.getVersions(601);

    expect(prismaMock.businessDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'sample_order',
        docNo: expect.stringMatching(/^PENDING-SAMPLE-/),
        status: 'draft',
        ownerUserId: 2001n,
        counterpartyId: 1001n,
        createdBy: 2001n,
      }),
    });
    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 601n },
      data: expect.objectContaining({
        docNo: created.sampleNo,
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'sample_order',
        bizId: 601n,
        operationType: 'create_sample_order',
        operatorId: 2001n,
      }),
    });
    expect(listed.items.map((item) => item.docNo)).toContain('SP202607110601');
    expect(detail).toMatchObject({
      id: 601,
      sampleNo: 'SP202607110601',
      currentStatus: 'draft',
      sourceQuoteOrderId: 7,
      sourceQuoteVersionNo: 3,
    });
    expect(versions).toEqual([
      expect.objectContaining({
        versionNo: 1,
        status: 'draft',
      }),
    ]);
    expect(created.currentStatus).toBe('draft');
    expect(created).toMatchObject({
      importantEnglishTitle: '智能 LED 灯带',
      salesProductCode: 'SKU-LED-001',
      internalProductCode: 'SKU-LED-001',
      imageUrls: [
        'http://127.0.0.1:3001/uploads/formal-quotes/led-source-front.png',
        'http://127.0.0.1:3001/uploads/formal-quotes/led-source-side.png',
      ],
      sampleQuantity: 500,
    });
  });

  it('updates sample snapshots for version replacement and cancellation in Prisma', async () => {
    process.env.ERP_STORAGE_MODE = 'prisma';
    const createdAt = new Date('2026-07-13T17:30:00.000Z');
    const basePayload = {
      id: 602,
      sampleNo: 'SP202607110602',
      currentVersionNo: 1,
      currentStatus: 'sample_sent',
      sourceQuoteOrderId: 7,
      sourceQuoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      createdAt: createdAt.toISOString(),
      sampleRequirements: 'Need blue variant sample',
      samplingCost: 1200,
      customerName: 'Acme Trading',
      ownerName: 'Zoe',
      quoteNo: 'Q202607080007',
      isReplacement: false,
      isCancelled: false,
      title: 'Acme Trading 样品单',
      secondaryStatus: 'quote_confirmed',
      versionHistory: [
        {
          versionNo: 1,
          status: 'sample_sent',
          createdAt: createdAt.toISOString(),
        },
      ],
    };
    const prismaMock = {
      businessDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id: 602n,
          bizType: 'sample_order',
          docNo: 'SP202607110602',
          status: 'sample_sent',
          ownerUserId: 2001n,
          counterpartyId: 1001n,
          payload: basePayload,
          createdBy: 2001n,
          createdAt,
          updatedAt: createdAt,
        }),
        update: jest.fn().mockResolvedValue({
          id: 602n,
          bizType: 'sample_order',
          docNo: 'SP202607110602',
          status: 'canceled',
          ownerUserId: 2001n,
          counterpartyId: 1001n,
          payload: {
            ...basePayload,
            currentVersionNo: 2,
            currentStatus: 'canceled',
            isCancelled: true,
            versionHistory: [
              ...basePayload.versionHistory,
              {
                versionNo: 2,
                status: 'pending_approval',
                createdAt: createdAt.toISOString(),
                changeReason: 'Customer requested new color',
                replacedVersionNo: 1,
              },
            ],
          },
          createdBy: 2001n,
          createdAt,
          updatedAt: createdAt,
        }),
      },
      operationLog: {
        create: jest.fn().mockResolvedValue({ id: 2n }),
      },
    };
    const prisma = prismaMock as unknown as PrismaService;

    const service = new SampleOrderService(prisma);
    const versioned = await service.createVersion({
      sampleOrderId: 602,
      currentStatus: 'sample_sent',
      currentVersionNo: 1,
      createdBy: 2001,
      changeReason: 'Customer requested new color',
      sampleRequirements: 'Need blue variant sample',
    });
    const canceled = await service.cancel({
      sampleOrderId: 602,
      currentStatus: 'pending_approval',
      hasProductionStarted: false,
      cancelReason: 'Supplier cannot continue',
    });

    expect(prismaMock.businessDocument.update).toHaveBeenCalledWith({
      where: { id: 602n },
      data: expect.objectContaining({
        status: 'canceled',
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'sample_order',
        bizId: 602n,
        operationType: 'create_sample_order_version',
      }),
    });
    expect(prismaMock.operationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bizType: 'sample_order',
        bizId: 602n,
        operationType: 'cancel_sample_order',
      }),
    });
    expect(versioned.currentVersionNo).toBe(2);
    expect(versioned.replacedVersionNo).toBe(1);
    expect(canceled.currentStatus).toBe('canceled');
  });
});
