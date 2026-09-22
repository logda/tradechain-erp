import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { PurchaseOrderController } from '../src/purchase-order/purchase-order.controller';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';

describe('PurchaseOrderController', () => {
  it('createFromSalesOrder returns product-split purchase orders via PurchaseOrderService', async () => {
    const createFromSalesOrder = jest.fn().mockResolvedValue({
      purchaseOrders: [
        {
          id: 1,
          purchaseNo: 'P202607080001',
          sourceSalesOrderId: 88,
          supplierId: 3001,
          currentVersionNo: 1,
          status: 'draft',
          itemCount: 1,
          createdBy: 2001,
        },
        {
          id: 2,
          purchaseNo: 'P202607080002',
          sourceSalesOrderId: 88,
          supplierId: 3002,
          currentVersionNo: 1,
          status: 'draft',
          itemCount: 1,
          createdBy: 2001,
        },
      ],
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder,
            getDetail: jest.fn(),
            saveDraft: jest.fn(),
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(PurchaseOrderController);
    const result = await controller.createFromSalesOrder(88 as never, {
      createdBy: 2001,
      salesOrderNo: 'S202607080088',
      customerOrderNo: 'PO-ACME-20260708',
      storeName: '02 Libuys',
      orderDate: '2026-07-08',
      factoryEstimatedDeliveryDate: '2026-08-08',
      shipTo: 'SH Boninoe',
      ownerName: 'Leo',
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    }, 'purchase', 'Leo');

    expect(createFromSalesOrder).toHaveBeenCalledWith(expect.objectContaining({
      salesOrderId: 88,
      createdBy: 2001,
      salesOrderNo: 'S202607080088',
      customerOrderNo: 'PO-ACME-20260708',
      storeName: '02 Libuys',
      orderDate: '2026-07-08',
      factoryEstimatedDeliveryDate: '2026-08-08',
      shipTo: 'SH Boninoe',
      ownerName: 'Leo',
      session: {
        role: 'purchase',
        user: 'Leo',
      },
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    }));
    expect(result.purchaseOrders).toHaveLength(2);
  });

  it('lists purchase owner options from PurchaseOrderService', async () => {
    const listAssignablePurchaseOwners = jest.fn().mockResolvedValue([
      {
        id: 4,
        username: 'leo',
        realName: 'Leo',
        roleCode: 'purchase',
        status: 'active',
      },
    ]);
    const moduleRef = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder: jest.fn(),
            listAssignablePurchaseOwners,
            getDetail: jest.fn(),
            saveDraft: jest.fn(),
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(PurchaseOrderController);
    const result = await controller.listOwnerOptions('purchase', 'Leo');

    expect(listAssignablePurchaseOwners).toHaveBeenCalledWith({
      role: 'purchase',
      user: 'Leo',
    });
    expect(result).toEqual([
      {
        id: 4,
        username: 'leo',
        realName: 'Leo',
        roleCode: 'purchase',
        status: 'active',
      },
    ]);
  });

  it('createFromSalesOrder uses ParseIntPipe on the salesOrderId route param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      PurchaseOrderController,
      'createFromSalesOrder',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });

  it('submit forwards the normalized currentStatus contract', async () => {
    const submit = jest.fn().mockResolvedValue({
      id: 19,
      status: 'pending_purchase_manager_approval',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder: jest.fn(),
            getDetail: jest.fn(),
            saveDraft: jest.fn(),
            submit,
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(PurchaseOrderController);
    const result = await controller.submit(19 as never, {
      currentStatus: 'draft',
    });

    expect(submit).toHaveBeenCalledWith({
      purchaseOrderId: 19,
      currentStatus: 'draft',
    });
    expect(result.status).toBe('pending_purchase_manager_approval');
  });

  it('saveDraft forwards owner edits with the current formal session', async () => {
    const saveDraft = jest.fn().mockResolvedValue({
      id: 19,
      status: 'draft',
      ownerName: 'Leo',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder: jest.fn(),
            getDetail: jest.fn(),
            saveDraft,
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(PurchaseOrderController);
    const result = await controller.saveDraft(
      19 as never,
      {
        currentStatus: 'draft',
        ownerName: 'Leo',
        supplierId: 3002,
        supplierName: 'Bravo Industrial',
        'unitPrice:1': '13.25',
      },
      'purchase',
      'Leo',
    );

    expect(saveDraft).toHaveBeenCalledWith({
      purchaseOrderId: 19,
      currentStatus: 'draft',
      ownerName: 'Leo',
      supplierId: 3002,
      supplierName: 'Bravo Industrial',
      itemPricePatches: [
        {
          lineNo: 1,
          unitPrice: 13.25,
        },
      ],
      session: {
        role: 'purchase',
        user: 'Leo',
      },
    });
    expect(result.ownerName).toBe('Leo');
  });

  it('resubmit forwards currentStatus and hasShipmentBatches', async () => {
    const resubmit = jest.fn().mockResolvedValue({
      id: 19,
      status: 'pending_purchase_manager_approval',
      nextVersionNo: 2,
      sourceSalesOrderId: 88,
      supplierId: 3009,
      changeReason: 'Switch to alternate supplier for lead time',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder: jest.fn(),
            getDetail: jest.fn(),
            saveDraft: jest.fn(),
            submit: jest.fn(),
            approve: jest.fn(),
            reject: jest.fn(),
            resubmit,
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    const controller = moduleRef.get(PurchaseOrderController);
    const result = await controller.resubmit(19 as never, {
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      sourceSalesOrderId: 88,
      supplierId: 3009,
      changeReason: 'Switch to alternate supplier for lead time',
    });

    expect(resubmit).toHaveBeenCalledWith({
      purchaseOrderId: 19,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      sourceSalesOrderId: 88,
      supplierId: 3009,
      changeReason: 'Switch to alternate supplier for lead time',
    });
    expect(result.nextVersionNo).toBe(2);
  });

  it('cancel forwards currentStatus, hasShipmentBatches, and cancelReason', async () => {
    const cancel = jest.fn().mockResolvedValue({
      id: 19,
      status: 'void',
      cancelReason: '供应商交期变化，采购单作废',
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [
        {
          provide: PurchaseOrderService,
          useValue: {
            createFromSalesOrder: jest.fn(),
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

    const controller = moduleRef.get(PurchaseOrderController);
    const result = await controller.cancel(19 as never, {
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      cancelReason: '供应商交期变化，采购单作废',
    });

    expect(cancel).toHaveBeenCalledWith({
      purchaseOrderId: 19,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      cancelReason: '供应商交期变化，采购单作废',
    });
    expect(result.cancelReason).toBe('供应商交期变化，采购单作废');
  });
});
