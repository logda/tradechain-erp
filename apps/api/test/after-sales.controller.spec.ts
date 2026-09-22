import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { AfterSalesController } from '../src/after-sales/after-sales.controller';
import { AfterSalesService } from '../src/after-sales/after-sales.service';

describe('AfterSalesController', () => {
  it('creates an after-sales order from shipment context', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 5,
      afterSalesNo: 'AS202607080001',
      status: 'pending_submit',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AfterSalesController],
      providers: [{ provide: AfterSalesService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(AfterSalesController);
    const result = await controller.create({
      salesOrderId: 9,
      shipmentBatchId: 3,
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2001,
    });

    expect(create).toHaveBeenCalled();
    expect(result.status).toBe('pending_submit');
  });

  it('uses ParseIntPipe for the after-sales detail id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      AfterSalesController,
      'getDetail',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });

  it('forwards finance confirmation payload to the service', async () => {
    const confirmFinance = jest.fn().mockResolvedValue({
      id: 5,
      financeReviewStatus: 'confirmed',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [AfterSalesController],
      providers: [{ provide: AfterSalesService, useValue: { confirmFinance } }],
    }).compile();

    const controller = moduleRef.get(AfterSalesController);
    const result = await controller.confirmFinance(5, {
      currentStatus: 'finance_reviewing',
      financeReviewStatus: 'pending',
    });

    expect(confirmFinance).toHaveBeenCalledWith({
      afterSalesOrderId: 5,
      currentStatus: 'finance_reviewing',
      financeReviewStatus: 'pending',
    });
    expect(result.financeReviewStatus).toBe('confirmed');
  });
});
