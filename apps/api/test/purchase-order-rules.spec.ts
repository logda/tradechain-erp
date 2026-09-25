import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';

describe('PurchaseOrderService', () => {
  it('splits a sales order into purchase orders by product with currentVersionNo 1', async () => {
    const service = new PurchaseOrderService();

    const result = await service.createFromSalesOrder({
      salesOrderId: 88,
      salesOrderNo: 'S2609250088',
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
        {
          salesItemId: 2,
          supplierId: 3001,
          productId: 502,
          quantity: 5,
          unitPrice: 8,
        },
        {
          salesItemId: 3,
          supplierId: 3002,
          productId: 503,
          quantity: 3,
          unitPrice: 20,
        },
      ],
    });

    expect(result.purchaseOrders).toHaveLength(3);
    expect(result.purchaseOrders.map((item) => item.purchaseNo)).toEqual([
      'C2609250088-1',
      'C2609250088-2',
      'C2609250088-3',
    ]);
    expect(result.purchaseOrders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceSalesOrderId: 88,
          supplierId: 3001,
          currentVersionNo: 1,
          status: 'draft',
          itemCount: 1,
          createdBy: 2001,
        }),
        expect.objectContaining({
          sourceSalesOrderId: 88,
          supplierId: 3002,
          currentVersionNo: 1,
          status: 'draft',
          itemCount: 1,
          createdBy: 2001,
        }),
      ]),
    );
  });

  it('uses supplier name passed from product master data when creating purchase orders', async () => {
    const service = new PurchaseOrderService();

    const result = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 2,
          supplierName: 'Bravo Industrial',
          productId: 1,
          quantity: 10,
          unitPrice: 8.5,
        },
      ],
    });

    expect(result.purchaseOrders[0]).toMatchObject({
      supplierId: 2,
      supplierName: 'Bravo Industrial',
    });
  });

  it('uses the persisted source sales number instead of a stale request value', async () => {
    const source = {
      getDetail: jest.fn().mockResolvedValue({
        salesNo: 'S2609250099',
        status: 'purchasing',
        customerOrderNo: 'CUSTOMER-PO-99',
      }),
      syncOperationalAggregates: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PurchaseOrderService(undefined, source as never);
    const result = await service.createFromSalesOrder({
      salesOrderId: 99,
      salesOrderNo: 'S2609250001',
      customerOrderNo: 'STALE-PO',
      createdBy: 2001,
      items: [{ salesItemId: 1, supplierId: 3001, productId: 501, quantity: 1 }],
    });

    expect(result.purchaseOrders[0].purchaseNo).toBe('C2609250099');
    expect(result.purchaseOrders[0].salesOrderNo).toBe('S2609250099');
    expect(result.purchaseOrders[0].customerOrderNo).toBe('CUSTOMER-PO-99');
  });

  it('uses purchase owner passed from product master data when no owner is selected', async () => {
    const service = new PurchaseOrderService();

    const result = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 2,
          supplierName: 'Bravo Industrial',
          purchaseOwnerName: 'Nina',
          productId: 1,
          quantity: 10,
          unitPrice: 8.5,
        },
      ],
    });

    expect(result.purchaseOrders[0]).toMatchObject({
      ownerName: 'Nina',
    });
  });

  it('creates sales-approved purchase orders in pending purchase claim status', async () => {
    const service = new PurchaseOrderService();

    const result = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      initialStatus: 'pending_purchase_claim',
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    });

    expect(result.purchaseOrders[0]).toMatchObject({
      status: 'pending_purchase_claim',
      versionHistory: [
        expect.objectContaining({
          versionNo: 1,
          status: 'pending_purchase_claim',
        }),
      ],
    });
  });

  it('creates draft purchase orders with a pending supplier when product supplier is not configured', async () => {
    const service = new PurchaseOrderService();

    const result = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      initialStatus: 'pending_purchase_claim',
      items: [
        {
          salesItemId: 1,
          supplierId: 0,
          productId: 0,
          sku: 'SKU-UNKNOWN-001',
          productName: '未配置供应商商品',
          quantity: 10,
          unitPrice: 0,
        },
      ],
    });

    expect(result.purchaseOrders[0]).toMatchObject({
      supplierId: 0,
      supplierName: '待补供应商',
      status: 'pending_purchase_claim',
      items: [
        expect.objectContaining({
          unitPrice: 0,
          amount: 0,
        }),
      ],
    });
  });

  it('limits purchase owner selection by current purchase role', async () => {
    const service = new PurchaseOrderService(
      undefined,
      undefined,
      {
        listAssignablePurchaseUsers: jest.fn().mockResolvedValue([
          {
            id: 4,
            username: 'leo',
            realName: 'Leo',
            roleCode: 'purchase',
            status: 'active',
          },
          {
            id: 5,
            username: 'nina',
            realName: 'Nina',
            roleCode: 'purchase',
            status: 'active',
          },
          {
            id: 6,
            username: 'paul',
            realName: 'Paul',
            roleCode: 'purchase_manager',
            status: 'active',
          },
        ]),
      } as never,
    );

    await expect(
      service.createFromSalesOrder({
        salesOrderId: 88,
        createdBy: 2002,
        ownerName: 'Nina',
        session: { role: 'purchase', user: 'Leo' },
        items: [
          {
            salesItemId: 1,
            supplierId: 2,
            productId: 1,
            quantity: 10,
            unitPrice: 8.5,
          },
        ],
      }),
    ).rejects.toThrow('当前角色不能选择该采购负责人');

    const purchaseOptions = await service.listAssignablePurchaseOwners({
      role: 'purchase',
      user: 'Leo',
    });
    const managerOptions = await service.listAssignablePurchaseOwners({
      role: 'purchase_manager',
      user: 'Paul',
    });
    const bossOptions = await service.listAssignablePurchaseOwners({
      role: 'boss',
      user: 'Mia',
    });

    expect(purchaseOptions.map((item) => item.realName)).toEqual(['Leo']);
    expect(managerOptions.map((item) => item.realName)).toEqual(
      expect.arrayContaining(['Paul', 'Leo', 'Nina']),
    );
    expect(bossOptions.map((item) => item.realName)).toEqual(
      expect.arrayContaining(['Mia', 'Paul', 'Leo', 'Nina']),
    );
  });

  it('persists created purchase orders into list and detail views', async () => {
    const service = new PurchaseOrderService();

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      salesOrderNo: 'S2609250088',
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
        {
          salesItemId: 2,
          supplierId: 3002,
          productId: 503,
          quantity: 3,
          unitPrice: 20,
        },
      ],
    });

    expect(createdResult.purchaseOrders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(Number),
          purchaseNo: expect.stringMatching(/^C2609250088-[12]$/),
        }),
      ]),
    );

    const listed = await service.list({
      page: 1,
      pageSize: 20,
    });

    expect(listed.items.map((item) => item.docNo)).toEqual(
      expect.arrayContaining(
        createdResult.purchaseOrders.map((item) => item.purchaseNo),
      ),
    );

    const firstCreated = createdResult.purchaseOrders[0];
    const detail = await service.getDetail(firstCreated.id);

    expect(firstCreated.id).toBeGreaterThan(3);
    expect(detail.purchaseNo).toBe(firstCreated.purchaseNo);
    expect(detail.status).toBe('draft');
    expect(detail.currentVersionNo).toBe(1);
  });

  it('hides purchase order detail from another purchase user', async () => {
    const service = new PurchaseOrderService();

    await expect(
      service.getDetail(1, { role: 'purchase', user: 'Zoe' }),
    ).rejects.toThrow('采购单不存在');
    await expect(
      service.getDetail(1, { role: 'purchase_manager', user: 'Mia' }),
    ).resolves.toMatchObject({ purchaseNo: 'P202607080001' });
  });

  it('carries sales line traceability into purchase order line items', async () => {
    const service = new PurchaseOrderService();

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      salesOrderNo: 'S202607080088',
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
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          internalCode: '501',
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          packageQuantity: 20,
          unitsPerPackage: 25,
          unitPrice: 12.5,
          imageUrls: [
            'http://127.0.0.1:3001/uploads/quote-led.png',
          ],
          factoryEstimatedDeliveryDate: '2026-08-08',
          shipTo: 'SH Boninoe',
          domesticFreight: 120,
        },
      ],
    });

    const created = createdResult.purchaseOrders[0];
    const detail = await service.getDetail(created.id);

    expect(created.items).toEqual([
      expect.objectContaining({
        lineNo: 1,
        sourceSalesItemId: 1,
        supplierId: 3001,
        productId: 501,
        internalCode: '501',
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        quantity: 500,
        packageQuantity: 20,
        unitsPerPackage: 25,
        unitPrice: 12.5,
        amount: 6250,
        imageUrls: [
          'http://127.0.0.1:3001/uploads/quote-led.png',
        ],
        factoryEstimatedDeliveryDate: '2026-08-08',
        shipTo: 'SH Boninoe',
        domesticFreight: 120,
      }),
    ]);
    expect(detail.items).toEqual(created.items);
    expect(detail.salesOrderNo).toBe('S202607080088');
    expect(detail.customerOrderNo).toBe('PO-ACME-20260708');
    expect(detail.storeName).toBe('02 Libuys');
    expect(detail.orderDate).toBe('2026-07-08');
    expect(detail.factoryEstimatedDeliveryDate).toBe('2026-08-08');
    expect(detail.shipTo).toBe('SH Boninoe');
    expect(detail.purchaseOrderAttachments).toEqual([
      expect.objectContaining({
        fileName: 'sales-spec.pdf',
      }),
    ]);
  });

  it('creates pending-supplier purchase orders when any sales item has no supplier', async () => {
    const service = new PurchaseOrderService();

    const result = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
        {
          salesItemId: 2,
          supplierId: 0,
          productId: 502,
          quantity: 5,
          unitPrice: 8,
        },
      ],
    });

    expect(result.purchaseOrders).toEqual([
      expect.objectContaining({
        supplierId: 3001,
        supplierName: 'Acme Supply',
      }),
      expect.objectContaining({
        supplierId: 0,
        supplierName: '待补供应商',
      }),
    ]);
  });

  it('returns purchase detail in a semantically consistent draft-stage placeholder state', async () => {
    const service = new PurchaseOrderService();

    const result = await service.getDetail(19);

    expect(result.purchaseNo).toBe('P202607080001');
    expect(result.status).toBe('draft');
    expect(result.currentVersionNo).toBe(1);
  });

  it('submits a draft purchase order into pending purchase manager approval', async () => {
    const service = new PurchaseOrderService();

    const result = await service.submit({
      purchaseOrderId: 19,
      currentStatus: 'draft',
    });

    expect(result.status).toBe('pending_purchase_manager_approval');
  });

  it('submits a pending purchase claim order into pending purchase manager approval', async () => {
    const service = new PurchaseOrderService();

    const result = await service.submit({
      purchaseOrderId: 19,
      currentStatus: 'pending_purchase_claim',
    });

    expect(result.status).toBe('pending_purchase_manager_approval');
  });

  it('creates inactive product records when a purchase order is submitted', async () => {
    const productCreate = jest.fn().mockResolvedValue({
      id: 9001,
      sku: 'PRD-TEST-001',
      nameCn: '采购入库测试商品',
      unit: 'pcs',
      purchaseCode: '',
      status: 'inactive',
    });
    const productActivate = jest.fn();
    const service = new PurchaseOrderService(
      undefined,
      {
        syncOperationalAggregates: jest.fn(),
        getDetail: jest.fn().mockResolvedValue({
          id: 88,
          salesNo: 'S202607080088',
          status: 'purchasing',
          items: [
            {
              lineNo: 1,
              productName: '采购入库测试商品',
              unit: 'pcs',
              salePrice: 15.5,
            },
          ],
        }),
      } as never,
      undefined,
      {
        create: productCreate,
        activate: productActivate,
      } as never,
    );

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      initialStatus: 'pending_purchase_claim',
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 0,
          sku: '',
          productName: '采购入库测试商品',
          unit: 'pcs',
          quantity: 10,
          unitPrice: 11.2,
        },
      ],
    });

    const created = createdResult.purchaseOrders[0];
    const result = await service.submit({
      purchaseOrderId: created.id,
      currentStatus: 'pending_purchase_claim',
    });

    expect(result.status).toBe('pending_purchase_manager_approval');
    expect(productCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: expect.stringMatching(/^PRD-/),
        nameCn: '采购入库测试商品',
        defaultSalePrice: 15.5,
        defaultPurchasePrice: 11.2,
        ownerName: 'Leo',
        createdBy: 'Leo',
        status: 'inactive',
      }),
    );

    const detail = await service.getDetail(created.id);
    expect(detail.items[0]).toEqual(
      expect.objectContaining({
        productId: 9001,
        productStatus: 'inactive',
        sku: 'PRD-TEST-001',
      }),
    );
    expect(productActivate).not.toHaveBeenCalled();
  });

  it('rejects purchase submission before supplier is completed', async () => {
    const service = new PurchaseOrderService();
    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      initialStatus: 'pending_purchase_claim',
      items: [
        {
          salesItemId: 1,
          supplierId: 0,
          productId: 0,
          sku: 'SKU-UNKNOWN-001',
          productName: '未配置供应商商品',
          quantity: 10,
          unitPrice: 0,
        },
      ],
    });
    const created = createdResult.purchaseOrders[0];

    await expect(
      service.submit({
        purchaseOrderId: created.id,
        currentStatus: 'pending_purchase_claim',
      }),
    ).rejects.toThrow('请先补充供应商后再提交采购审批');
  });

  it('rejects purchase submission before purchase price is completed', async () => {
    const service = new PurchaseOrderService();
    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      initialStatus: 'pending_purchase_claim',
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 0,
        },
      ],
    });
    const created = createdResult.purchaseOrders[0];

    await expect(
      service.submit({
        purchaseOrderId: created.id,
        currentStatus: 'pending_purchase_claim',
      }),
    ).rejects.toThrow('请先补充采购价后再提交采购审批');
  });

  it('saves purchase owner edits while keeping draft and claim statuses unchanged', async () => {
    const service = new PurchaseOrderService();

    const draftCreatedResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    });
    const draftCreated = draftCreatedResult.purchaseOrders[0];
    const draftResult = await service.saveDraft({
      purchaseOrderId: draftCreated.id,
      currentStatus: 'draft',
      ownerName: 'Nina',
    });
    expect(draftResult).toMatchObject({
      status: 'draft',
      ownerName: 'Nina',
    });

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 89,
      createdBy: 2001,
      initialStatus: 'pending_purchase_claim',
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    });
    const created = createdResult.purchaseOrders[0];
    const claimResult = await service.saveDraft({
      purchaseOrderId: created.id,
      currentStatus: 'pending_purchase_claim',
      ownerName: 'Leo',
    });
    const claimDetail = await service.getDetail(created.id);

    expect(claimResult).toMatchObject({
      status: 'pending_purchase_claim',
      ownerName: 'Leo',
    });
    expect(claimDetail).toMatchObject({
      status: 'pending_purchase_claim',
      ownerName: 'Leo',
    });
  });

  it('saves supplier and purchase price edits while keeping draft and claim statuses unchanged', async () => {
    const service = new PurchaseOrderService();
    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      initialStatus: 'pending_purchase_claim',
      items: [
        {
          salesItemId: 1,
          supplierId: 0,
          productId: 0,
          sku: 'SKU-UNKNOWN-001',
          productName: '未配置供应商商品',
          quantity: 10,
          unitPrice: 0,
        },
      ],
    });
    const created = createdResult.purchaseOrders[0];
    const result = await service.saveDraft({
      purchaseOrderId: created.id,
      currentStatus: 'pending_purchase_claim',
      ownerName: 'Leo',
      supplierId: 3002,
      itemPricePatches: [
        {
          lineNo: 1,
          unitPrice: 13.25,
        },
      ],
    });
    const detail = await service.getDetail(created.id);

    expect(result).toMatchObject({
      status: 'pending_purchase_claim',
      supplierId: 3002,
      supplierName: 'Bravo Industrial',
    });
    expect(detail).toMatchObject({
      supplierId: 3002,
      supplierName: 'Bravo Industrial',
      items: [
        expect.objectContaining({
          supplierId: 3002,
          unitPrice: 13.25,
          amount: 132.5,
        }),
      ],
    });
  });

  it('rejects purchase owner edits after the purchase order leaves draft stages', async () => {
    const service = new PurchaseOrderService();

    await expect(
      service.saveDraft({
        purchaseOrderId: 19,
        currentStatus: 'purchasing',
        ownerName: 'Leo',
      }),
    ).rejects.toThrow('Only draft or pending purchase claim orders can be saved');
  });

  it('approves a pending purchase order into purchasing', async () => {
    const service = new PurchaseOrderService();

    const result = await service.approve({
      purchaseOrderId: 19,
      currentStatus: 'pending_purchase_manager_approval',
    });

    expect(result.status).toBe('purchasing');
  });

  it('rejects purchase approval before purchase price is completed', async () => {
    const service = new PurchaseOrderService();
    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      initialStatus: 'pending_purchase_manager_approval',
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 0,
        },
      ],
    });
    const created = createdResult.purchaseOrders[0];

    await expect(
      service.approve({
        purchaseOrderId: created.id,
        currentStatus: 'pending_purchase_manager_approval',
      }),
    ).rejects.toThrow('请先补充采购价后再通过采购审批');
  });

  it('rejects a pending purchase order back to draft', async () => {
    const service = new PurchaseOrderService();

    const result = await service.reject({
      purchaseOrderId: 19,
      currentStatus: 'pending_purchase_manager_approval',
    });

    expect(result.status).toBe('draft');
  });

  it('rejects invalid approval transitions', async () => {
    const service = new PurchaseOrderService();

    await expect(
      service.approve({
        purchaseOrderId: 19,
        currentStatus: 'draft',
      }),
    ).rejects.toThrow(
      'Only pending purchase manager approval orders can be approved',
    );
  });

  it('allows purchase resubmission with supplier change while preserving sourceSalesOrderId', async () => {
    const service = new PurchaseOrderService();

    const result = await service.resubmit({
      purchaseOrderId: 19,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      sourceSalesOrderId: 88,
      supplierId: 3009,
      changeReason: 'Switch to alternate supplier for lead time',
    });

    expect(result.status).toBe('pending_purchase_manager_approval');
    expect(result.nextVersionNo).toBe(2);
    expect(result.sourceSalesOrderId).toBe(88);
    expect(result.supplierId).toBe(3009);
  });

  it('rejects purchase cancellation after shipment has started', async () => {
    const service = new PurchaseOrderService();

    await expect(
      service.cancel({
        purchaseOrderId: 19,
        currentStatus: 'purchasing',
        hasShipmentBatches: true,
        cancelReason: '供应商交期变化，采购单作废',
      }),
    ).rejects.toThrow('Cannot cancel after shipment has started');
  });

  it('records a version timeline after purchase order resubmission', async () => {
    const service = new PurchaseOrderService();

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    });

    const created = createdResult.purchaseOrders[0];

    await service.submit({
      purchaseOrderId: created.id,
      currentStatus: 'draft',
    });
    await service.approve({
      purchaseOrderId: created.id,
      currentStatus: 'pending_purchase_manager_approval',
    });
    const resubmitted = await service.resubmit({
      purchaseOrderId: created.id,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      sourceSalesOrderId: 88,
      supplierId: 3001,
      changeReason: '供应商交期延迟，需要重新提交',
    });

    const detail = await service.getDetail(created.id);

    expect(resubmitted.nextVersionNo).toBe(2);
    expect(detail.currentVersionNo).toBe(2);
    expect(detail.versionHistory).toEqual([
      expect.objectContaining({
        versionNo: 1,
        status: 'draft',
      }),
      expect.objectContaining({
        versionNo: 2,
        status: 'pending_purchase_manager_approval',
        changeReason: '供应商交期延迟，需要重新提交',
      }),
    ]);
  });

  it('cancels an unshipped purchasing purchase order', async () => {
    const service = new PurchaseOrderService();

    const result = await service.cancel({
      purchaseOrderId: 19,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      cancelReason: '供应商交期变化，采购单作废',
    });

    expect(result.status).toBe('void');
    expect(result.cancelReason).toBe('供应商交期变化，采购单作废');
  });

  it('lists only active linked purchase orders for a sales order', async () => {
    const service = new PurchaseOrderService();

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
        {
          salesItemId: 2,
          supplierId: 3002,
          productId: 503,
          quantity: 5,
          unitPrice: 20,
        },
      ],
    });

    const [activePurchaseOrder, voidPurchaseOrder] = createdResult.purchaseOrders;

    await service.submit({
      purchaseOrderId: voidPurchaseOrder.id,
      currentStatus: 'draft',
    });
    await service.approve({
      purchaseOrderId: voidPurchaseOrder.id,
      currentStatus: 'pending_purchase_manager_approval',
    });
    await service.cancel({
      purchaseOrderId: voidPurchaseOrder.id,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      cancelReason: '供应商交期变化，采购单作废',
    });

    const result = await service.listActiveLinkedPurchaseOrders({
      salesOrderId: 88,
      salesOrderNo: 'S202607080088',
    });

    expect(result).toEqual([
      {
        id: activePurchaseOrder.id,
        purchaseNo: activePurchaseOrder.purchaseNo,
        status: 'draft',
      },
    ]);
  });

  it('records purchase cancellation reason in the version timeline', async () => {
    const service = new PurchaseOrderService();

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    });

    const created = createdResult.purchaseOrders[0];

    await service.submit({
      purchaseOrderId: created.id,
      currentStatus: 'draft',
    });
    await service.approve({
      purchaseOrderId: created.id,
      currentStatus: 'pending_purchase_manager_approval',
    });
    await service.cancel({
      purchaseOrderId: created.id,
      currentStatus: 'purchasing',
      hasShipmentBatches: false,
      cancelReason: '供应商交期变化，采购单作废',
    });

    const detail = await service.getDetail(created.id);

    expect(detail.status).toBe('void');
    expect(detail.versionHistory).toContainEqual(
      expect.objectContaining({
        versionNo: 1,
        status: 'void',
        changeReason: '供应商交期变化，采购单作废',
      }),
    );
  });

  it('persists purchase order status transitions in the created detail record', async () => {
    const service = new PurchaseOrderService();

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    });

    const created = createdResult.purchaseOrders[0];
    await service.submit({
      purchaseOrderId: created.id,
      currentStatus: 'draft',
    });

    const afterSubmit = await service.getDetail(created.id);

    expect(afterSubmit.status).toBe('pending_purchase_manager_approval');
  });

  it('syncs source sales order purchase aggregate when purchase orders are created and approved', async () => {
    const syncOperationalAggregates = jest.fn().mockResolvedValue({});
    const service = new PurchaseOrderService(
      undefined,
      { syncOperationalAggregates } as never,
    );

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
      ],
    });
    const created = createdResult.purchaseOrders[0];

    await service.submit({
      purchaseOrderId: created.id,
      currentStatus: 'draft',
    });
    await service.approve({
      purchaseOrderId: created.id,
      currentStatus: 'pending_purchase_manager_approval',
    });

    expect(syncOperationalAggregates).toHaveBeenCalledWith({
      salesOrderId: 88,
      purchaseAggregateStatus: 'draft',
      operatorId: 2001,
      source: 'purchase_order',
    });
    expect(syncOperationalAggregates).toHaveBeenCalledWith({
      salesOrderId: 88,
      purchaseAggregateStatus: 'approved',
      operatorId: 2001,
      source: 'purchase_order',
    });
  });

  it('syncs purchase order fulfillment from shipment and rolls up partial sales purchase status', async () => {
    const syncOperationalAggregates = jest.fn().mockResolvedValue({});
    const service = new PurchaseOrderService(
      undefined,
      { syncOperationalAggregates } as never,
    );

    const createdResult = await service.createFromSalesOrder({
      salesOrderId: 88,
      createdBy: 2001,
      items: [
        {
          salesItemId: 1,
          supplierId: 3001,
          productId: 501,
          quantity: 10,
          unitPrice: 12.5,
        },
        {
          salesItemId: 2,
          supplierId: 3002,
          productId: 503,
          quantity: 3,
          unitPrice: 20,
        },
      ],
    });
    const [firstPurchaseOrder] = createdResult.purchaseOrders;

    const result = await service.syncShipmentFulfillmentStatus({
      purchaseOrderId: firstPurchaseOrder.id,
      status: 'partial_arrived',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    const detail = await service.getDetail(firstPurchaseOrder.id);

    expect(result.status).toBe('partial_arrived');
    expect(detail.status).toBe('partial_arrived');
    expect(syncOperationalAggregates).toHaveBeenCalledWith({
      salesOrderId: 88,
      purchaseAggregateStatus: 'partial_arrived',
      operatorId: 2002,
      source: 'purchase_order',
    });
  });
});
