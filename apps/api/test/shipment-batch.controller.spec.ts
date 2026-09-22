import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ShipmentBatchController } from '../src/shipment-batch/shipment-batch.controller';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';

describe('ShipmentBatchController', () => {
  it('creates a shipment batch from purchase execution context', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 3,
      batchNo: 'SH202607080001',
      status: 'shipped',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [ShipmentBatchController],
      providers: [{ provide: ShipmentBatchService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(ShipmentBatchController);
    const result = await controller.create({
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

    expect(create).toHaveBeenCalled();
    expect(result.status).toBe('shipped');
  });

  it('uses ParseIntPipe for the shipment batch detail id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      ShipmentBatchController,
      'getDetail',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
