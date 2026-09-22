import { ParseIntPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { SampleOrderController } from '../src/sample-order/sample-order.controller';
import { SampleOrderService } from '../src/sample-order/sample-order.service';

describe('SampleOrderController', () => {
  it('creates a sample order from a confirmed quote version', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 9,
      sampleNo: 'SP202607080001',
      currentVersionNo: 1,
      currentStatus: 'draft',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleOrderController],
      providers: [{ provide: SampleOrderService, useValue: { create } }],
    }).compile();

    const controller = moduleRef.get(SampleOrderController);
    const result = await controller.create({
      quoteOrderId: 7,
      quoteVersionNo: 3,
      customerId: 1001,
      createdBy: 2001,
      quoteConfirmed: true,
      sampleRequirements: 'Need gold-plated sample',
    });

    expect(create).toHaveBeenCalled();
    expect(result.currentStatus).toBe('draft');
  });

  it('delegates draft saving to SampleOrderService', async () => {
    const saveDraft = jest.fn().mockResolvedValue({
      id: 9,
      currentStatus: 'draft',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleOrderController],
      providers: [{ provide: SampleOrderService, useValue: { saveDraft } }],
    }).compile();

    const controller = moduleRef.get(SampleOrderController);
    const result = await controller.saveDraft(9, {
      currentStatus: 'draft',
      sampleRequirements: 'Need draft sample',
      samplingCost: 18.5,
      sampleQuantity: 3,
      purchaseUnit: '深圳星河工厂',
      estimatedCompletionDate: '2026-07-28',
    });

    expect(saveDraft).toHaveBeenCalledWith({
      sampleOrderId: 9,
      currentStatus: 'draft',
      sampleRequirements: 'Need draft sample',
      samplingCost: 18.5,
      sampleQuantity: 3,
      purchaseUnit: '深圳星河工厂',
      estimatedCompletionDate: '2026-07-28',
    });
    expect(result.currentStatus).toBe('draft');
  });

  it('delegates draft submission to SampleOrderService with execution fields', async () => {
    const submit = jest.fn().mockResolvedValue({
      id: 9,
      currentStatus: 'pending_approval',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleOrderController],
      providers: [{ provide: SampleOrderService, useValue: { submit } }],
    }).compile();

    const controller = moduleRef.get(SampleOrderController);
    const result = await controller.submit(9, {
      currentStatus: 'draft',
      sampleRequirements: 'Need draft sample',
      samplingCost: 18.5,
      sampleQuantity: 3,
      purchaseUnit: '深圳星河工厂',
      estimatedCompletionDate: '2026-07-28',
    } as never);

    expect(submit).toHaveBeenCalledWith({
      sampleOrderId: 9,
      currentStatus: 'draft',
      sampleRequirements: 'Need draft sample',
      samplingCost: 18.5,
      sampleQuantity: 3,
      purchaseUnit: '深圳星河工厂',
      estimatedCompletionDate: '2026-07-28',
    });
    expect(result.currentStatus).toBe('pending_approval');
  });

  it('delegates audit log loading to SampleOrderService', async () => {
    const listAuditLogs = jest.fn().mockResolvedValue({ items: [] });
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleOrderController],
      providers: [{ provide: SampleOrderService, useValue: { listAuditLogs } }],
    }).compile();

    const controller = moduleRef.get(SampleOrderController);
    const result = await controller.listAuditLogs();

    expect(listAuditLogs).toHaveBeenCalled();
    expect(result).toEqual({ items: [] });
  });

  it('delegates source quote sample summary loading to SampleOrderService', async () => {
    const getSourceQuoteSampleSummary = jest.fn().mockResolvedValue({
      quoteOrderId: 7,
      totalSampleCount: 2,
      activeSampleCount: 1,
      latestSampleNo: 'SP202607110102',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleOrderController],
      providers: [{ provide: SampleOrderService, useValue: { getSourceQuoteSampleSummary } }],
    }).compile();

    const controller = moduleRef.get(SampleOrderController);
    const result = await controller.getSourceQuoteSampleSummary(7);

    expect(getSourceQuoteSampleSummary).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      quoteOrderId: 7,
      totalSampleCount: 2,
      activeSampleCount: 1,
      latestSampleNo: 'SP202607110102',
    });
  });

  it('delegates no-followup close action to SampleOrderService', async () => {
    const closeNoFollowup = jest.fn().mockResolvedValue({
      id: 9,
      currentStatus: 'closed_no_followup',
      closeReason: '客户确认暂无后续',
    });
    const moduleRef = await Test.createTestingModule({
      controllers: [SampleOrderController],
      providers: [{ provide: SampleOrderService, useValue: { closeNoFollowup } }],
    }).compile();

    const controller = moduleRef.get(SampleOrderController);
    const result = await controller.closeNoFollowup(9, {
      currentStatus: 'sample_sent',
      closeReason: '客户确认暂无后续',
    });

    expect(closeNoFollowup).toHaveBeenCalledWith({
      sampleOrderId: 9,
      currentStatus: 'sample_sent',
      closeReason: '客户确认暂无后续',
    });
    expect(result.currentStatus).toBe('closed_no_followup');
  });

  it('uses ParseIntPipe for the sample detail id param', () => {
    const metadata = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      SampleOrderController,
      'getDetail',
    ) as Record<string, { pipes: unknown[] }>;

    expect(metadata['5:0']?.pipes).toHaveLength(1);
    expect(metadata['5:0']?.pipes[0]).toBe(ParseIntPipe);
  });
});
