import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';

describe('ShipmentBatchService', () => {
  it('creates a shipment batch and marks the related sales order as locked by first shipment', async () => {
    const service = new ShipmentBatchService();

    const result = await service.create({
      salesOrderId: 9,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-08T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-001',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    expect(result.status).toBe('shipped');
    expect(result.salesOrderLocked).toBe(true);
    expect(result.purchaseOrderStatus).toBe('partial_shipped');
  });

  it('creates another shipment batch when the purchase order is partially shipped', async () => {
    const service = new ShipmentBatchService();

    await service.create({
      salesOrderId: 9,
      purchaseOrderId: 121,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-08T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-001-1',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    const result = await service.create({
      salesOrderId: 9,
      purchaseOrderId: 121,
      shippedQty: 60,
      accumulatedQty: 100,
      remainingQty: 0,
      shippedAt: '2026-07-08T12:30:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-001-2',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'partial_shipped',
      currentBatchCount: 1,
    });

    expect(result.status).toBe('shipped');
    expect(result.salesOrderLocked).toBe(false);
    expect(result.purchaseOrderStatus).toBe('shipped');
  });

  it('creates another shipment batch after a previous partial shipment has arrived', async () => {
    const service = new ShipmentBatchService();

    await service.create({
      salesOrderId: 9,
      purchaseOrderId: 123,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-08T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-PARTIAL-ARRIVED-1',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    const result = await service.create({
      salesOrderId: 9,
      purchaseOrderId: 123,
      shippedQty: 60,
      accumulatedQty: 100,
      remainingQty: 0,
      shippedAt: '2026-07-08T12:30:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-PARTIAL-ARRIVED-2',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'partial_arrived',
      currentBatchCount: 1,
    });

    expect(result.status).toBe('shipped');
    expect(result.salesOrderLocked).toBe(false);
    expect(result.purchaseOrderStatus).toBe('shipped');
  });

  it('rejects another shipment batch when accumulated quantity ignores existing shipments', async () => {
    const service = new ShipmentBatchService();

    await service.create({
      salesOrderId: 9,
      purchaseOrderId: 122,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-08T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-001-3',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    await expect(
      service.create({
        salesOrderId: 9,
        purchaseOrderId: 122,
        shippedQty: 60,
        accumulatedQty: 60,
        remainingQty: 40,
        shippedAt: '2026-07-08T12:30:00.000Z',
        shippingCode: 'SHIP-TEST-AUTO-001-4',
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'partial_shipped',
        currentBatchCount: 1,
      }),
    ).rejects.toThrow(
      'Accumulated quantity must equal previous shipped quantity plus shipped quantity',
    );
  });

  it('rejects shipment batch creation before purchase approval is completed', async () => {
    const service = new ShipmentBatchService();

    await expect(
      service.create({
        salesOrderId: 9,
        purchaseOrderId: 21,
        shippedQty: 40,
        accumulatedQty: 40,
        remainingQty: 60,
        shippedAt: '2026-07-08T12:00:00.000Z',
        shippingCode: 'SHIP-TEST-AUTO-002',
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'draft',
        currentBatchCount: 0,
      }),
    ).rejects.toThrow('Only purchasing purchase orders can create shipment batches');
  });

  it('rejects shipped shipment batch creation without shipping code', async () => {
    const service = new ShipmentBatchService();

    await expect(
      service.create({
        salesOrderId: 9,
        purchaseOrderId: 21,
        shippedQty: 40,
        accumulatedQty: 40,
        remainingQty: 60,
        shippedAt: '2026-07-08T12:00:00.000Z',
        shippingCode: '   ',
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'purchasing',
        currentBatchCount: 0,
      }),
    ).rejects.toThrow('Shipping code is required for shipped batches');
  });

  it('uses the real purchase order status when checking shipment creation', async () => {
    const service = new ShipmentBatchService(
      undefined,
      undefined,
      {
        getDetail: jest.fn().mockResolvedValue({ status: 'draft' }),
        syncShipmentFulfillmentStatus: jest.fn(),
      } as never,
    );

    await expect(
      service.create({
        salesOrderId: 9,
        purchaseOrderId: 21,
        shippedQty: 40,
        accumulatedQty: 40,
        remainingQty: 60,
        shippedAt: '2026-07-08T12:00:00.000Z',
        shippingCode: 'SHIP-TEST-AUTO-003',
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'purchasing',
        currentBatchCount: 0,
      }),
    ).rejects.toThrow('Only purchasing purchase orders can create shipment batches');
  });

  it('uses the linked purchase order detail for shipment traceability labels', async () => {
    const service = new ShipmentBatchService(
      undefined,
      undefined,
      {
        getDetail: jest.fn().mockResolvedValue({
          status: 'purchasing',
          salesOrderNo: 'S202607110104',
          purchaseNo: 'P202607110108',
          supplierName: '测试供应商-T07280616-001',
        }),
        syncShipmentFulfillmentStatus: jest.fn(),
      } as never,
    );

    const created = await service.create({
      salesOrderId: 104,
      purchaseOrderId: 108,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-004',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });
    const listed = await service.list({
      docNo: created.batchNo,
      page: 1,
      pageSize: 20,
    });

    expect(listed.items).toContainEqual(
      expect.objectContaining({
        docNo: created.batchNo,
        salesOrderNo: 'S202607110104',
        purchaseOrderNo: 'P202607110108',
        supplierName: '测试供应商-T07280616-001',
      }),
    );
  });

  it('persists shipment ledger fields for purchase and sales visible views', async () => {
    const service = new ShipmentBatchService(
      undefined,
      undefined,
      {
        getDetail: jest.fn().mockResolvedValue({
          status: 'purchasing',
          salesOrderNo: 'S202607110104',
          purchaseNo: 'P202607110108',
          supplierName: '测试供应商-T07280616-001',
          shipTo: '宁波仓',
          factoryEstimatedDeliveryDate: '2026-08-08',
          items: [
            {
              packageQuantity: 12,
            },
          ],
        }),
        syncShipmentFulfillmentStatus: jest.fn(),
      } as never,
    );

    const created = await service.create({
      salesOrderId: 104,
      purchaseOrderId: 108,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T12:00:00.000Z',
      factoryShipDate: '2026-07-11',
      shippingCodeItems: [
        { code: 'SHIP-TEST-001', quantity: 25 },
        { code: 'SHIP-TEST-002', quantity: 15 },
      ],
      destination: '上海目的仓',
      shippingMark: 'MARK-001',
      goodsName: '测试发货商品',
      totalPackages: 20,
      purchasingUnit: '测试采购单位',
      customerName: '测试客户',
      freightStation: '测试货运站',
      warehouseEntryNo: 'WH-TEST-001',
      arrivalStatus: '已发',
      forwarderShipDate: '2026-07-12',
      estimatedArrivalDate: '2026-08-09',
      remark: '测试备注',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });
    const detail = await service.getDetail(created.id);
    const list = await service.list({
      docNo: created.batchNo,
      page: 1,
      pageSize: 20,
    });

    expect(detail).toEqual(
      expect.objectContaining({
        factoryShipDate: '2026-07-11',
        shippingCode: 'SHIP-TEST-001 x 25\nSHIP-TEST-002 x 15',
        shippingCodeItems: [
          { code: 'SHIP-TEST-001', quantity: 25 },
          { code: 'SHIP-TEST-002', quantity: 15 },
        ],
        destination: '上海目的仓',
        shippingMark: 'MARK-001',
        goodsName: '测试发货商品',
        totalPackages: 20,
        purchasingUnit: '测试采购单位',
        customerName: '测试客户',
        freightStation: '测试货运站',
        warehouseEntryNo: 'WH-TEST-001',
        arrivalStatus: '已发',
        forwarderShipDate: '2026-07-12',
        estimatedArrivalDate: '2026-08-09',
        remark: '测试备注',
      }),
    );
    expect(list.items[0]).toEqual(
      expect.objectContaining({
        docNo: created.batchNo,
        shippingCode: 'SHIP-TEST-001 x 25\nSHIP-TEST-002 x 15',
        shippingCodeItems: [
          { code: 'SHIP-TEST-001', quantity: 25 },
          { code: 'SHIP-TEST-002', quantity: 15 },
        ],
        goodsName: '测试发货商品',
        customerName: '测试客户',
        purchasingUnit: '测试采购单位',
      }),
    );
  });

  it('rejects shipment batch creation when shipping code quantities do not match shipped quantity', async () => {
    const service = new ShipmentBatchService();

    await expect(
      service.create({
        salesOrderId: 9,
        purchaseOrderId: 123,
        shippedQty: 40,
        accumulatedQty: 40,
        remainingQty: 60,
        shippedAt: '2026-07-08T12:00:00.000Z',
        shippingCodeItems: [
          { code: 'SHIP-QTY-001', quantity: 10 },
          { code: 'SHIP-QTY-002', quantity: 20 },
        ],
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'purchasing',
        currentBatchCount: 0,
      }),
    ).rejects.toThrow('Shipping code quantity total must equal shipped quantity');
  });

  it('returns the created shipment batch detail for the new batch id', async () => {
    const service = new ShipmentBatchService();

    const created = await service.create({
      salesOrderId: 9,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-08T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-006',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });
    const detail = await service.getDetail(created.id);

    expect(detail.id).toBe(created.id);
    expect(detail.batchNo).toBe(created.batchNo);
    expect(detail.status).toBe(created.status);
  });

  it('carries purchase line traceability into shipment batch line items', async () => {
    const service = new ShipmentBatchService();

    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 460,
      shippedAt: '2026-07-08T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-007',
      createdBy: 2001,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
      items: [
        {
          purchaseLineNo: 1,
          sourceSalesItemId: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          shippedQty: 40,
          purchaseQty: 500,
        },
      ],
    });

    const detail = await service.getDetail(created.id);

    expect(created.items).toEqual([
      expect.objectContaining({
        lineNo: 1,
        purchaseLineNo: 1,
        sourceSalesItemId: 1,
        productId: 501,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        shippedQty: 40,
        purchaseQty: 500,
      }),
    ]);
    expect(detail.items).toEqual(created.items);
  });

  it('rejects shipment batch creation when shipped quantity exceeds purchase quantity', async () => {
    const service = new ShipmentBatchService(
      undefined,
      undefined,
      {
        getDetail: jest.fn().mockResolvedValue({
          status: 'purchasing',
          items: [{ quantity: 100 }],
        }),
        syncShipmentFulfillmentStatus: jest.fn(),
      } as never,
    );

    await expect(
      service.create({
        salesOrderId: 9,
        purchaseOrderId: 21,
        shippedQty: 120,
        accumulatedQty: 120,
        remainingQty: 0,
        shippedAt: '2026-07-08T12:00:00.000Z',
        shippingCode: 'SHIP-TEST-AUTO-008',
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'purchasing',
        currentBatchCount: 0,
      }),
    ).rejects.toThrow('Shipped quantity cannot exceed purchase quantity');
  });

  it('rejects shipment batch creation when a shipment line exceeds its purchase line quantity', async () => {
    const service = new ShipmentBatchService(
      undefined,
      undefined,
      {
        getDetail: jest.fn().mockResolvedValue({
          status: 'purchasing',
          items: [{ quantity: 40 }],
        }),
        syncShipmentFulfillmentStatus: jest.fn(),
      } as never,
    );

    await expect(
      service.create({
        salesOrderId: 88,
        purchaseOrderId: 21,
        shippedQty: 40,
        accumulatedQty: 40,
        remainingQty: 460,
        shippedAt: '2026-07-08T12:00:00.000Z',
        shippingCode: 'SHIP-TEST-AUTO-009',
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'purchasing',
        currentBatchCount: 0,
        items: [
          {
            purchaseLineNo: 1,
            sourceSalesItemId: 1,
            productId: 501,
            sku: 'SKU-LED-001',
            productName: '智能 LED 灯带',
            unit: 'set',
            shippedQty: 40,
            purchaseQty: 30,
          },
        ],
      }),
    ).rejects.toThrow(
      'Shipment line shipped quantity cannot exceed purchase line quantity',
    );
  });

  it('rejects shipment batch creation when accumulated quantity is less than shipped quantity', async () => {
    const service = new ShipmentBatchService();

    await expect(
      service.create({
        salesOrderId: 9,
        purchaseOrderId: 21,
        shippedQty: 40,
        accumulatedQty: 20,
        remainingQty: 80,
        shippedAt: '2026-07-08T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-008',
        createdBy: 2001,
        purchaseOrderCurrentStatus: 'purchasing',
        currentBatchCount: 0,
      }),
    ).rejects.toThrow('Accumulated quantity cannot be less than shipped quantity');
  });

  it('moves a shipment batch through forwarder, forwarder shipped, and arrived statuses', async () => {
    const service = new ShipmentBatchService();
    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 121,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-OPERATOR-001',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    const toForwarder = await service.markToForwarder({
      shipmentBatchId: created.id,
      currentStatus: 'shipped',
      operatorId: 9000,
    });
    const forwarderShipped = await service.markForwarderShipped({
      shipmentBatchId: created.id,
      currentStatus: toForwarder.status,
      operatorId: 9000,
    });
    const arrived = await service.markArrived({
      shipmentBatchId: created.id,
      currentStatus: forwarderShipped.status,
      operatorId: 9000,
    });
    const auditLogs = await service.listAuditLogs();

    expect(toForwarder.status).toBe('to_forwarder');
    expect(forwarderShipped.status).toBe('forwarder_shipped');
    expect(arrived.status).toBe('arrived');
    expect(
      auditLogs.items.filter(
        (item) =>
          item.bizId === created.id &&
          [
            'mark_shipment_to_forwarder',
            'mark_shipment_forwarder_shipped',
            'mark_shipment_arrived',
          ].includes(item.operationType),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operationType: 'mark_shipment_to_forwarder', operatorId: 9000 }),
        expect.objectContaining({ operationType: 'mark_shipment_forwarder_shipped', operatorId: 9000 }),
        expect.objectContaining({ operationType: 'mark_shipment_arrived', operatorId: 9000 }),
      ]),
    );
  });

  it('rejects a repeated shipment transition even when the caller resends the old status', async () => {
    const service = new ShipmentBatchService();
    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 121,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T12:00:00.000Z',
      shippingCode: 'SHIP-REPLAY-001',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });
    await service.markToForwarder({ shipmentBatchId: created.id, currentStatus: 'shipped' });

    await expect(service.markToForwarder({
      shipmentBatchId: created.id,
      currentStatus: 'shipped',
    })).rejects.toThrow();
    const logs = await service.listAuditLogs();
    expect(logs.items.filter((item) => item.bizId === created.id &&
      item.operationType === 'mark_shipment_to_forwarder')).toHaveLength(1);
  });

  it('requires an uploaded receipt before sending it to the customer', async () => {
    const service = new ShipmentBatchService();

    await expect(
      service.sendReceipt({
        shipmentBatchId: 3,
        receiptDocUrl: null,
        sentBy: 2001,
      }),
    ).rejects.toThrow('Receipt document is required before sending');
  });

  it('persists receipt upload and send traceability into shipment batch detail', async () => {
    const service = new ShipmentBatchService();

    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-009',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    await service.uploadReceipt({
      shipmentBatchId: created.id,
      receiptDocUrl: 'https://files.example.com/receipt-101.pdf',
      operatorId: 9000,
    });
    await service.sendReceipt({
      shipmentBatchId: created.id,
      receiptDocUrl: 'https://files.example.com/receipt-101.pdf',
      sentBy: 2002,
      operatorId: 9000,
    });
    await expect(service.sendReceipt({
      shipmentBatchId: created.id,
      receiptDocUrl: 'https://files.example.com/receipt-101.pdf',
      sentBy: 2002,
      operatorId: 9000,
    })).rejects.toThrow();

    const detail = await service.getDetail(created.id);
    const auditLogs = await service.listAuditLogs();

    expect((detail as { receiptDocUrl?: string }).receiptDocUrl).toBe(
      'https://files.example.com/receipt-101.pdf',
    );
    expect((detail as { receiptSentBy?: number }).receiptSentBy).toBe(2002);
    expect((detail as { receiptSendStatus?: string }).receiptSendStatus).toBe(
      'sent',
    );
    expect(auditLogs.items.filter((item) => item.bizId === created.id &&
      item.operationType === 'send_shipment_receipt')).toHaveLength(1);
    expect(
      auditLogs.items.filter(
        (item) =>
          item.bizId === created.id &&
          ['upload_shipment_receipt', 'send_shipment_receipt'].includes(item.operationType),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operationType: 'upload_shipment_receipt', operatorId: 9000 }),
        expect.objectContaining({ operationType: 'send_shipment_receipt', operatorId: 9000 }),
      ]),
    );
  });

  it('persists shipment batch exception reason into detail', async () => {
    const service = new ShipmentBatchService();

    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-010',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    await service.markToForwarder({
      shipmentBatchId: created.id,
      currentStatus: 'shipped',
    });
    await service.markForwarderShipped({
      shipmentBatchId: created.id,
      currentStatus: 'to_forwarder',
    });
    await service.markException({
      shipmentBatchId: created.id,
      currentStatus: 'forwarder_shipped',
      reason: '货物破损，需要售后处理',
    });

    const detail = await service.getDetail(created.id);

    expect((detail as { hasException?: boolean }).hasException).toBe(true);
    expect((detail as { exceptionReason?: string }).exceptionReason).toBe(
      '货物破损，需要售后处理',
    );
  });

  it('persists created shipment batches into list and detail views', async () => {
    const service = new ShipmentBatchService();

    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-011',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });

    const listed = await service.list({ page: 1, pageSize: 20 });
    const detail = await service.getDetail(created.id);

    expect(listed.items.map((item) => item.docNo)).toEqual(
      expect.arrayContaining([created.batchNo]),
    );
    expect(detail.batchNo).toBe(created.batchNo);
    expect(detail.status).toBe('shipped');
  });

  it('syncs purchase order status, source sales order shipment aggregate, and receipt status', async () => {
    const syncOperationalAggregates = jest.fn().mockResolvedValue({});
    const syncShipmentFulfillmentStatus = jest.fn().mockResolvedValue({});
    const service = new ShipmentBatchService(
      undefined,
      { syncOperationalAggregates } as never,
      { syncShipmentFulfillmentStatus } as never,
    );

    const created = await service.create({
      salesOrderId: 88,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-012',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });
    const toForwarder = await service.markToForwarder({
      shipmentBatchId: created.id,
      currentStatus: 'shipped',
    });
    const forwarderShipped = await service.markForwarderShipped({
      shipmentBatchId: created.id,
      currentStatus: toForwarder.status,
    });
    const arrived = await service.markArrived({
      shipmentBatchId: created.id,
      currentStatus: forwarderShipped.status,
    });
    await service.uploadReceipt({
      shipmentBatchId: created.id,
      receiptDocUrl: 'https://files.example.com/receipt-101.pdf',
    });
    await service.sendReceipt({
      shipmentBatchId: created.id,
      receiptDocUrl: 'https://files.example.com/receipt-101.pdf',
      sentBy: 2002,
    });

    expect(arrived.status).toBe('arrived');
    expect(syncShipmentFulfillmentStatus).toHaveBeenCalledWith({
      purchaseOrderId: 21,
      status: 'partial_shipped',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncShipmentFulfillmentStatus).toHaveBeenCalledWith({
      purchaseOrderId: 21,
      status: 'partial_to_forwarder',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncShipmentFulfillmentStatus).toHaveBeenCalledWith({
      purchaseOrderId: 21,
      status: 'partial_forwarder_shipped',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncShipmentFulfillmentStatus).toHaveBeenCalledWith({
      purchaseOrderId: 21,
      status: 'partial_arrived',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncOperationalAggregates).toHaveBeenCalledWith({
      salesOrderId: 88,
      shipmentAggregateStatus: 'partial_shipped',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncOperationalAggregates).toHaveBeenCalledWith({
      salesOrderId: 88,
      shipmentAggregateStatus: 'partial_to_forwarder',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncOperationalAggregates).toHaveBeenCalledWith({
      salesOrderId: 88,
      shipmentAggregateStatus: 'partial_forwarder_shipped',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncOperationalAggregates).toHaveBeenCalledWith({
      salesOrderId: 88,
      shipmentAggregateStatus: 'partial_arrived',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncOperationalAggregates).toHaveBeenCalledWith({
      salesOrderId: 88,
      receiptSendStatus: 'sent',
      operatorId: 2002,
      source: 'shipment_batch',
    });
  });

  it('keeps the source sales order shipment aggregate partial when another linked purchase order has not shipped', async () => {
    const syncOperationalAggregates = jest.fn().mockResolvedValue({});
    const syncShipmentFulfillmentStatus = jest.fn().mockResolvedValue({});
    const service = new ShipmentBatchService(
      undefined,
      { syncOperationalAggregates } as never,
      {
        getDetail: jest.fn().mockResolvedValue({
          status: 'purchasing',
          salesOrderNo: 'S202607110106',
          purchaseNo: 'P202607110110',
          supplierName: '测试双身份往来单位',
        }),
        listActiveLinkedPurchaseOrders: jest.fn().mockResolvedValue([
          { id: 21, purchaseNo: 'P202607110110', status: 'arrived' },
          {
            id: 22,
            purchaseNo: 'P202607110111',
            status: 'pending_purchase_claim',
          },
        ]),
        syncShipmentFulfillmentStatus,
      } as never,
    );

    const created = await service.create({
      salesOrderId: 106,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 0,
      shippedAt: '2026-07-11T12:00:00.000Z',
      shippingCode: 'SHIP-TEST-AUTO-013',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
    });
    const toForwarder = await service.markToForwarder({
      shipmentBatchId: created.id,
      currentStatus: 'shipped',
    });
    const forwarderShipped = await service.markForwarderShipped({
      shipmentBatchId: created.id,
      currentStatus: toForwarder.status,
    });
    await service.markArrived({
      shipmentBatchId: created.id,
      currentStatus: forwarderShipped.status,
    });

    expect(syncOperationalAggregates).toHaveBeenLastCalledWith({
      salesOrderId: 106,
      shipmentAggregateStatus: 'partial_arrived',
      operatorId: 2002,
      source: 'shipment_batch',
    });
  });

  it('marks the source sales order shipped when the only linked purchase order is fully shipped', async () => {
    const syncOperationalAggregates = jest.fn().mockResolvedValue({});
    const syncShipmentFulfillmentStatus = jest.fn().mockResolvedValue({});
    const service = new ShipmentBatchService(
      undefined,
      { syncOperationalAggregates } as never,
      {
        getDetail: jest.fn().mockResolvedValue({
          status: 'partial_shipped',
          salesOrderNo: 'S202607110111',
          purchaseNo: 'P202607110121',
          supplierName: '测试供应商',
        }),
        listActiveLinkedPurchaseOrders: jest.fn().mockResolvedValue([
          { id: 121, purchaseNo: 'P202607110121', status: 'partial_shipped' },
        ]),
        syncShipmentFulfillmentStatus,
      } as never,
    );

    await service.create({
      salesOrderId: 111,
      purchaseOrderId: 121,
      shippedQty: 70,
      accumulatedQty: 120,
      remainingQty: 0,
      shippedAt: '2026-07-30T19:32:00.000Z',
      shippingCode: 'SHIP-0730P543333-C',
      shippingCodeItems: [{ code: 'SHIP-0730P543333-C', quantity: 70 }],
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'partial_shipped',
      currentBatchCount: 1,
      items: [
        {
          purchaseLineNo: 1,
          sourceSalesItemId: 1,
          productId: 25,
          sku: 'SALE-TEST-TIER-SUP-0730P543333',
          productName: '测试商品阶梯价选供应商0730P543333',
          unit: 'pcs',
          shippedQty: 70,
          purchaseQty: 120,
        },
      ],
    });

    expect(syncShipmentFulfillmentStatus).toHaveBeenCalledWith({
      purchaseOrderId: 121,
      status: 'shipped',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncOperationalAggregates).toHaveBeenLastCalledWith({
      salesOrderId: 111,
      shipmentAggregateStatus: 'shipped',
      operatorId: 2002,
      source: 'shipment_batch',
    });
  });

  it('keeps purchase order partial when only one of multiple shipment batches has arrived', async () => {
    const syncOperationalAggregates = jest.fn().mockResolvedValue({});
    const syncShipmentFulfillmentStatus = jest.fn().mockResolvedValue({});
    const service = new ShipmentBatchService(
      undefined,
      { syncOperationalAggregates } as never,
      {
        getDetail: jest.fn().mockResolvedValue({
          status: 'partial_shipped',
          salesOrderNo: 'S202607110111',
          purchaseNo: 'P202607110121',
          supplierName: '测试供应商',
        }),
        listActiveLinkedPurchaseOrders: jest.fn().mockResolvedValue([
          { id: 121, purchaseNo: 'P202607110121', status: 'partial_shipped' },
        ]),
        syncShipmentFulfillmentStatus,
      } as never,
    );

    await service.create({
      salesOrderId: 111,
      purchaseOrderId: 121,
      shippedQty: 50,
      accumulatedQty: 50,
      remainingQty: 70,
      shippedAt: '2026-07-30T19:25:00.000Z',
      shippingCode: 'SHIP-0730P543333-A',
      shippingCodeItems: [{ code: 'SHIP-0730P543333-A', quantity: 50 }],
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
      items: [
        {
          purchaseLineNo: 1,
          sourceSalesItemId: 1,
          productId: 25,
          sku: 'SALE-TEST-TIER-SUP-0730P543333',
          productName: '测试商品阶梯价选供应商0730P543333',
          unit: 'pcs',
          shippedQty: 50,
          purchaseQty: 120,
        },
      ],
    });
    const secondBatch = await service.create({
      salesOrderId: 111,
      purchaseOrderId: 121,
      shippedQty: 70,
      accumulatedQty: 120,
      remainingQty: 0,
      shippedAt: '2026-07-30T19:32:00.000Z',
      shippingCode: 'SHIP-0730P543333-C',
      shippingCodeItems: [{ code: 'SHIP-0730P543333-C', quantity: 70 }],
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'partial_shipped',
      currentBatchCount: 1,
      items: [
        {
          purchaseLineNo: 1,
          sourceSalesItemId: 1,
          productId: 25,
          sku: 'SALE-TEST-TIER-SUP-0730P543333',
          productName: '测试商品阶梯价选供应商0730P543333',
          unit: 'pcs',
          shippedQty: 70,
          purchaseQty: 120,
        },
      ],
    });

    const toForwarder = await service.markToForwarder({
      shipmentBatchId: secondBatch.id,
      currentStatus: secondBatch.status,
    });
    const forwarderShipped = await service.markForwarderShipped({
      shipmentBatchId: secondBatch.id,
      currentStatus: toForwarder.status,
    });
    await service.markArrived({
      shipmentBatchId: secondBatch.id,
      currentStatus: forwarderShipped.status,
    });
    const arrivedDetail = await service.getDetail(secondBatch.id);

    expect(syncShipmentFulfillmentStatus).toHaveBeenLastCalledWith({
      purchaseOrderId: 121,
      status: 'partial_arrived',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect(syncOperationalAggregates).toHaveBeenLastCalledWith({
      salesOrderId: 111,
      shipmentAggregateStatus: 'partial_arrived',
      operatorId: 2002,
      source: 'shipment_batch',
    });
    expect((arrivedDetail as { arrivalStatus?: string }).arrivalStatus).toBe(
      '已到货',
    );
  });
});
