import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { QuoteController } from '../src/quote/quote.controller';
import { QuoteService } from '../src/quote/quote.service';
import { ProductService } from '../src/product/product.service';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { SalesOrderController } from '../src/sales-order/sales-order.controller';
import { SalesOrderService } from '../src/sales-order/sales-order.service';

describe('SalesOrder controllers', () => {
  it('SalesOrderController.create forwards the direct-create sales contract', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 18,
      salesNo: 'S202607080018',
      status: 'draft',
      currentVersionNo: 1,
      sourceMode: 'direct',
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            create,
            getDetail: jest.fn(),
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.create({
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
    });

    expect(create).toHaveBeenCalledWith({
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
    });
    expect(result.status).toBe('draft');
    expect(result.sourceMode).toBe('direct');
  });

  it('QuoteController.convertToSales returns a draft sales order via SalesOrderService', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        {
          provide: QuoteService,
          useValue: {
            create: jest.fn(),
            getDetail: jest.fn().mockResolvedValue({
              id: 7,
              quoteNo: 'Q202607080007',
              currentVersionNo: 2,
              customerId: 1001,
              customerName: 'Acme Trading',
              sourceCode: 'expo',
              inquiryDate: '2026-07-08',
              destination: 'Shanghai',
              requirements: 'Need 500 units',
              salesUserId: 2001,
              items: [],
              quoteAttachments: [],
            }),
          },
        },
        {
          provide: SalesOrderService,
          useValue: {
            convertConfirmedQuote: jest.fn().mockResolvedValue({
              id: 10,
              salesNo: 'S202607080001',
              status: 'draft',
              currentVersionNo: 1,
              sourceQuoteOrderId: 7,
              items: [],
            }),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(QuoteController);
    const result = await controller.convertToSales(7 as never, {
      quoteVersionNo: 2,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      items: [],
    });

    expect(result.status).toBe('draft');
    expect(result.sourceQuoteOrderId).toBe(7);
  });

  it('QuoteController.convertToSales forwards quote line items to SalesOrderService', async () => {
    const convertConfirmedQuote = jest.fn().mockResolvedValue({
      id: 10,
      salesNo: 'S202607080001',
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
            create: jest.fn(),
            getDetail: jest.fn().mockResolvedValue({
              id: 7,
              quoteNo: 'Q202607080007',
              currentVersionNo: 2,
              customerId: 1001,
              customerName: 'Acme Trading',
              sourceCode: 'expo',
              inquiryDate: '2026-07-08',
              destination: 'Shanghai',
              requirements: 'Need 500 units',
              salesUserId: 2001,
              items: [
                {
                  lineNo: 1,
                  productId: 501,
                  sku: 'SKU-LED-001',
                  productName: '智能 LED 灯带',
                  unit: 'set',
                  quantity: 500,
                  salePrice: 15.9,
                  amount: 7950,
                },
              ],
              quoteAttachments: [],
            }),
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
      quoteVersionNo: 2,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      items: [
        {
          lineNo: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
          amount: 7950,
        },
      ],
    });

    expect(convertConfirmedQuote).toHaveBeenCalledWith({
      quoteOrderId: 7,
      quoteVersionNo: 2,
      customerId: 1001,
      customerName: 'Acme Trading',
      sourceQuoteNo: 'Q202607080007',
      sourceCode: 'expo',
      inquiryDate: '2026-07-08',
      destination: 'Shanghai',
      requirements: 'Need 500 units',
      createdBy: 2001,
      existingSalesOrderId: undefined,
      quoteConfirmed: true,
      items: [
        {
          lineNo: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
          amount: 7950,
        },
      ],
      quoteAttachments: [],
      sourceDocumentType: 'quote',
    });
  });

  it('QuoteController.convertToSales can infer missing quote payload fields from quote detail', async () => {
    const convertConfirmedQuote = jest.fn().mockResolvedValue({
      id: 10,
      salesNo: 'S202607080001',
      status: 'draft',
      currentVersionNo: 1,
      sourceQuoteOrderId: 7,
      items: [],
    });
    const getDetail = jest.fn().mockResolvedValue({
      id: 7,
      quoteNo: 'Q202607080007',
      currentVersionNo: 2,
      customerId: 1001,
      customerName: 'Acme Trading',
      sourceCode: 'expo',
      inquiryDate: '2026-07-08',
      destination: 'Shanghai',
      requirements: 'Need 500 units',
      salesUserId: 2001,
      items: [],
      quoteAttachments: [],
      sourceDocumentType: 'quote',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        {
          provide: QuoteService,
          useValue: {
            create: jest.fn(),
            getDetail,
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
      quoteVersionNo: 2,
      customerId: 1001,
      customerName: 'Acme Trading',
      sourceQuoteNo: 'Q202607080007',
      sourceCode: 'expo',
      inquiryDate: '2026-07-08',
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

  it('SalesOrderController.submit forwards the normalized currentStatus contract', async () => {
    const submit = jest.fn().mockResolvedValue({
      id: 9,
      status: 'pending_sales_manager_approval',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail: jest.fn(),
            submit,
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.submit(9 as never, {
      currentStatus: 'draft',
    });

    expect(submit).toHaveBeenCalledWith({
      salesOrderId: 9,
      currentStatus: 'draft',
    });
    expect(result.status).toBe('pending_sales_manager_approval');
  });

  it('SalesOrderController.assignPurchaser creates purchase orders from approved sales items', async () => {
    const approve = jest.fn().mockResolvedValue({
      id: 9,
      status: 'pending_purchase_assignment',
    });
    const getDetail = jest.fn().mockResolvedValue({
      id: 9,
      salesNo: 'S202607080009',
      status: 'pending_purchase_assignment',
      createdBy: 2001,
      customerOrderNo: 'PO-ACME-20260708',
      storeName: '02 Libuys',
      orderDate: '2026-07-08',
      estimatedDeliveryDate: '2026-08-08',
      shipTo: 'SH Boninoe',
      salesOrderAttachments: [
        {
          fileName: 'sales-spec.pdf',
          mimeType: 'application/pdf',
          size: 10,
          url: 'http://127.0.0.1:3001/uploads/sales-spec.pdf',
        },
      ],
      items: [
        {
          lineNo: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          packageQuantity: 20,
          unitsPerPackage: 25,
          totalQuantity: 500,
          salePrice: 15.9,
          amount: 7950,
          factoryPicUrls: [
            'http://127.0.0.1:3001/uploads/quote-led.png',
          ],
        },
      ],
    });
    const hydratePurchaseFieldsFromSourceQuote = jest.fn(
      async (salesOrder) => salesOrder.items,
    );
    const createFromSalesOrder = jest.fn().mockResolvedValue({
      purchaseOrders: [
        {
          id: 301,
          purchaseNo: 'P202607110301',
          sourceSalesOrderId: 9,
          supplierId: 4,
          status: 'pending_purchase_claim',
        },
      ],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail,
            hydratePurchaseFieldsFromSourceQuote,
            submit: jest.fn(),
            approve,
            completePurchaseAssignment: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder,
            listAssignablePurchaseOwners: jest.fn().mockResolvedValue([{ id: 2002, realName: 'Leo', status: 'active' }]),
          },
        },
        ProductService,
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.assignPurchaser(9, { ownerName: 'Leo' });
    expect(approve).not.toHaveBeenCalled();
    expect(hydratePurchaseFieldsFromSourceQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        salesNo: 'S202607080009',
      }),
    );
    expect(createFromSalesOrder).toHaveBeenCalledWith({
      salesOrderId: 9,
      createdBy: 2001,
      initialStatus: 'pending_purchase_claim',
      ownerName: 'Leo',
      allowPendingAssignment: true,
      items: [
        {
          salesItemId: 1,
          supplierId: 4,
          supplierName: 'Light Source Manufacturing',
          purchaseOwnerName: 'Leo',
          productId: 1,
          internalCode: 'PUR-LED-001',
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          packageQuantity: 20,
          unitsPerPackage: 25,
          unitPrice: 8.5,
          imageUrls: [
            'http://127.0.0.1:3001/uploads/quote-led.png',
          ],
        },
      ],
      salesOrderNo: 'S202607080009',
      customerOrderNo: 'PO-ACME-20260708',
      storeName: '02 Libuys',
      orderDate: '2026-07-08',
      factoryEstimatedDeliveryDate: '2026-08-08',
      shipTo: 'SH Boninoe',
      purchaseOrderAttachments: [
        {
          fileName: 'sales-spec.pdf',
          mimeType: 'application/pdf',
          size: 10,
          url: 'http://127.0.0.1:3001/uploads/sales-spec.pdf',
        },
      ],
    });
    expect((result as { purchaseOrders: unknown[] }).purchaseOrders).toHaveLength(1);
  });

  it('SalesOrderController.assignPurchaser prefers boss confirmed quote supplier and purchase price', async () => {
    const approve = jest.fn().mockResolvedValue({
      id: 11,
      status: 'purchasing',
    });
    const getDetail = jest.fn().mockResolvedValue({
      id: 11,
      salesNo: 'S202607080011',
      status: 'pending_purchase_assignment',
      createdBy: 2001,
      items: [
        {
          lineNo: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 120,
          totalQuantity: 120,
          salePrice: 20.88,
          amount: 2505.6,
        },
      ],
    });
    const hydratePurchaseFieldsFromSourceQuote = jest.fn().mockResolvedValue([
      {
        lineNo: 1,
        productId: 501,
        confirmedProductId: 8802,
        confirmedSupplierId: 3002,
        confirmedSupplierCode: 'SUP-BRAVO',
        confirmedSupplierName: 'Bravo Industrial',
        confirmedPurchasePrice: 9.77,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        quantity: 120,
        totalQuantity: 120,
        salePrice: 20.88,
        amount: 2505.6,
      },
    ]);
    const createFromSalesOrder = jest.fn().mockResolvedValue({
      purchaseOrders: [
        {
          id: 303,
          purchaseNo: 'P202607110303',
          sourceSalesOrderId: 11,
          supplierId: 3002,
          status: 'pending_purchase_claim',
        },
      ],
    });
    const resolvePurchaseSupplierForLine = jest.fn().mockResolvedValue({
      productId: 1,
      supplierId: 35,
      supplierName: '商品默认供应商',
      purchaseCode: 'DEFAULT-SUP-CODE',
      defaultPurchasePrice: 99.99,
      productName: '默认商品名',
      unit: 'pcs',
      purchaseOwnerName: 'Leo',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail,
            hydratePurchaseFieldsFromSourceQuote,
            submit: jest.fn(),
            approve,
            completePurchaseAssignment: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder,
            listAssignablePurchaseOwners: jest.fn().mockResolvedValue([{ id: 2002, realName: 'Leo', status: 'active' }]),
          },
        },
        {
          provide: ProductService,
          useValue: {
            resolvePurchaseSupplierForLine,
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    await controller.assignPurchaser(11, { ownerName: 'Leo' });

    expect(hydratePurchaseFieldsFromSourceQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 11,
        salesNo: 'S202607080011',
      }),
    );
    expect(resolvePurchaseSupplierForLine).toHaveBeenCalledWith({
      productId: 8802,
      sku: 'SKU-LED-001',
    });
    expect(createFromSalesOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        salesOrderId: 11,
        items: [
          expect.objectContaining({
            salesItemId: 1,
            supplierId: 3002,
            supplierName: 'Bravo Industrial',
            internalCode: 'SUP-BRAVO',
            productId: 1,
            unitPrice: 9.77,
            productName: '智能 LED 灯带',
            unit: 'set',
          }),
        ],
      }),
    );
  });

  it('SalesOrderController.assignPurchaser keeps supplier and purchase price empty when product master data is unavailable', async () => {
    const approve = jest.fn().mockResolvedValue({
      id: 10,
      status: 'purchasing',
    });
    const getDetail = jest.fn().mockResolvedValue({
      id: 10,
      salesNo: 'S202607080010',
      status: 'pending_purchase_assignment',
      createdBy: 2001,
      items: [
        {
          lineNo: 1,
          productId: 0,
          sku: 'SKU-NO-MASTER-001',
          productName: '无主数据商品',
          unit: 'pcs',
          quantity: 12,
          totalQuantity: 12,
          salePrice: 30,
          amount: 360,
        },
      ],
    });
    const hydratePurchaseFieldsFromSourceQuote = jest.fn(
      async (salesOrder) => salesOrder.items,
    );
    const createFromSalesOrder = jest.fn().mockResolvedValue({
      purchaseOrders: [
        {
          id: 302,
          purchaseNo: 'P202607110302',
          sourceSalesOrderId: 10,
          supplierId: 0,
          status: 'pending_purchase_claim',
        },
      ],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail,
            hydratePurchaseFieldsFromSourceQuote,
            submit: jest.fn(),
            approve,
            completePurchaseAssignment: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder,
            listAssignablePurchaseOwners: jest.fn().mockResolvedValue([{ id: 2002, realName: 'Leo', status: 'active' }]),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    await controller.assignPurchaser(10, { ownerName: 'Leo' });

    expect(createFromSalesOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        salesOrderId: 10,
        initialStatus: 'pending_purchase_claim',
        items: [
          expect.objectContaining({
            salesItemId: 1,
            supplierId: 0,
            productId: 0,
            internalCode: '',
            sku: 'SKU-NO-MASTER-001',
            productName: '无主数据商品',
            unitPrice: 0,
          }),
        ],
      }),
    );
  });

  it('SalesOrderController.getDetail includes active linked purchase order numbers', async () => {
    const getDetail = jest.fn().mockResolvedValue({
      id: 9,
      salesNo: 'S202607080009',
      status: 'purchasing',
      currentVersionNo: 1,
      purchaseAggregateStatus: 'purchasing',
      shipmentAggregateStatus: 'not_started',
      items: [],
    });
    const listActiveLinkedPurchaseOrders = jest.fn().mockResolvedValue([
      {
        id: 301,
        purchaseNo: 'P202607110301',
        status: 'purchasing',
      },
    ]);
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail,
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder: jest.fn(),
            listActiveLinkedPurchaseOrders,
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.getDetail(9 as never);

    expect(getDetail).toHaveBeenCalledWith(9, undefined);
    expect(listActiveLinkedPurchaseOrders).toHaveBeenCalledWith({
      salesOrderId: 9,
      salesOrderNo: 'S202607080009',
    });
    expect(result.linkedPurchaseOrders).toEqual([
      {
        id: 301,
        purchaseNo: 'P202607110301',
        status: 'purchasing',
      },
    ]);
  });

  it('SalesOrderController.cancel forwards currentStatus and unshipped purchase order ids', async () => {
    const cancel = jest.fn().mockResolvedValue({
      id: 9,
      status: 'void',
      autoVoidedPurchaseOrderIds: [3001, 3002],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail: jest.fn(),
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel,
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.cancel(9 as never, {
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      unshippedPurchaseOrderIds: [3001, 3002],
      cancelReason: '客户取消订单',
    });

    expect(cancel).toHaveBeenCalledWith({
      salesOrderId: 9,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      unshippedPurchaseOrderIds: [3001, 3002],
      cancelReason: '客户取消订单',
    });
    expect(result.autoVoidedPurchaseOrderIds).toEqual([3001, 3002]);
  });

  it('SalesOrderController.listAuditLogs delegates to SalesOrderService', async () => {
    const listAuditLogs = jest.fn().mockResolvedValue({
      items: [
        {
          id: 1,
          bizType: 'sales_order',
          bizId: 9,
          operationType: 'create_sales_order',
        },
      ],
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail: jest.fn(),
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
            listAuditLogs,
            updateReceiptStatus: jest.fn(),
            confirmFinance: jest.fn(),
            getCloseValidation: jest.fn(),
            close: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.listAuditLogs();

    expect(listAuditLogs).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
  });

  it('QuoteController.convertToSales uses ParseIntPipe on the quote id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      QuoteController,
      'convertToSales',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });

  it('SalesOrderController.getDetail uses ParseIntPipe on the sales id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      SalesOrderController,
      'getDetail',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });

  it('SalesOrderController.updateReceiptStatus forwards the receipt collection contract', async () => {
    const updateReceiptStatus = jest.fn().mockResolvedValue({
      id: 9,
      receiptStatus: 'fully_paid',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        {
          provide: SalesOrderService,
          useValue: {
            getDetail: jest.fn(),
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
            updateReceiptStatus,
            confirmFinance: jest.fn(),
            getCloseValidation: jest.fn(),
            close: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(SalesOrderController);
    const result = await controller.updateReceiptStatus(9 as never, {
      receiptStatus: 'fully_paid',
    });

    expect(updateReceiptStatus).toHaveBeenCalledWith({
      salesOrderId: 9,
      receiptStatus: 'fully_paid',
    });
    expect(result.receiptStatus).toBe('fully_paid');
  });
});
