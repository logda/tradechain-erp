import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { QuoteController } from '../src/quote/quote.controller';
import { QuoteService } from '../src/quote/quote.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('QuoteController', () => {
  it('creates a quote order draft', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        {
          provide: QuoteService,
          useValue: {
            create: jest.fn().mockResolvedValue({
              id: 1,
              quoteNo: 'Q202607070001',
              status: 'draft',
              currentVersionNo: 1,
            }),
          },
        },
        {
          provide: SalesOrderService,
          useValue: {
            convertConfirmedQuote: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuoteController);
    const result = await controller.create({
      customerId: 1001,
      salesUserId: 2001,
      sourceCode: 'expo',
      requirements: 'Need 500 units',
    });

    expect(result.status).toBe('draft');
    expect(result.currentVersionNo).toBe(1);
  });

  it('returns quote detail for a numeric id', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        {
          provide: QuoteService,
          useValue: {
            getDetail: jest.fn().mockResolvedValue({
              id: 7,
              quoteNo: 'Q202607070001',
              status: 'draft',
              currentVersionNo: 1,
              customerId: 1001,
              salesUserId: 2001,
              sourceCode: 'expo',
              requirements: 'Need 500 units',
              items: [
                {
                  lineNo: 1,
                  sku: 'SKU-LED-001',
                  productName: '智能 LED 灯带',
                  quantity: 500,
                  unit: 'set',
                  salePrice: 15.9,
                  amount: 7950,
                },
              ],
            }),
          },
        },
        {
          provide: SalesOrderService,
          useValue: {
            convertConfirmedQuote: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuoteController);
    const result = await controller.getDetail(7 as never);

    expect(result.id).toBe(7);
    expect(result.status).toBe('draft');
    expect(result.customerId).toBe(1001);
    expect(result.salesUserId).toBe(2001);
    expect(result.sourceCode).toBe('expo');
    expect(result.requirements).toBe('Need 500 units');
    expect(result.items).toHaveLength(1);
  });

  it('lists quote audit logs from the controller', async () => {
    const listAuditLogs = jest.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          bizType: 'quote',
          bizId: 7,
          operationType: 'create_quote',
        },
      ],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        {
          provide: QuoteService,
          useValue: {
            listAuditLogs,
          },
        },
        {
          provide: SalesOrderService,
          useValue: {
            convertConfirmedQuote: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuoteController);
    const result = await controller.listAuditLogs();

    expect(listAuditLogs).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });

  it('converts quote to sales using quote detail when payload omits optional fields', async () => {
    const getDetail = jest.fn().mockResolvedValue({
      id: 7,
      quoteNo: 'Q202607070001',
      currentVersionNo: 3,
      customerId: 1001,
      customerName: 'Acme Trading',
      sourceCode: 'expo',
      inquiryDate: '2026-07-07',
      destination: 'Shanghai',
      requirements: 'Need 500 units',
      salesUserId: 2001,
      items: [],
      quoteAttachments: [],
      sourceDocumentType: 'quote',
    });
    const convertConfirmedQuote = jest.fn().mockResolvedValue({
      id: 11,
      salesNo: 'S202607080011',
      status: 'draft',
      currentVersionNo: 1,
      sourceQuoteOrderId: 7,
      items: [],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        {
          provide: QuoteService,
          useValue: {
            getDetail,
            listAuditLogs: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: SalesOrderService,
          useValue: {
            convertConfirmedQuote,
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuoteController);
    await controller.convertToSales(7 as never, {
      quoteConfirmed: true,
    });

    expect(getDetail).toHaveBeenCalledWith(7);
    expect(convertConfirmedQuote).toHaveBeenCalledWith({
      quoteOrderId: 7,
      quoteVersionNo: 3,
      customerId: 1001,
      customerName: 'Acme Trading',
      sourceQuoteNo: 'Q202607070001',
      sourceCode: 'expo',
      inquiryDate: '2026-07-07',
      destination: 'Shanghai',
      requirements: 'Need 500 units',
      createdBy: 2001,
      existingSalesOrderId: undefined,
      quoteConfirmed: true,
      items: [],
      quoteAttachments: [],
      sourceDocumentType: 'quote',
    });
  });

  it('uses ParseIntPipe for the quote detail id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      QuoteController,
      'getDetail',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
