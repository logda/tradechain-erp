import { Test } from '@nestjs/testing';
import { AuditService } from '../src/audit/audit.service';
import { QuoteService } from '../src/quote/quote.service';
import { InquiryService } from '../src/inquiry/inquiry.service';
import { SampleOrderService } from '../src/sample-order/sample-order.service';
import { SalesOrderService } from '../src/sales-order/sales-order.service';
import { PurchaseOrderService } from '../src/purchase-order/purchase-order.service';
import { ShipmentBatchService } from '../src/shipment-batch/shipment-batch.service';
import { AfterSalesService } from '../src/after-sales/after-sales.service';
import { CounterpartyService } from '../src/counterparty/counterparty.service';
import { ProductService } from '../src/product/product.service';
import { UserManagementService } from '../src/user-management/user-management.service';

const userManagementServiceMock = {
  listOperatorDirectory: jest.fn().mockResolvedValue([
    { id: 10, username: 'zoe', realName: 'Zoe' },
    { id: 11, username: 'leo', realName: 'Leo' },
  ]),
};

describe('AuditService', () => {
  it('aggregates audit logs across modules with module labels and newest-first ordering', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: QuoteService,
          useValue: {
            listAuditLogs: jest.fn().mockResolvedValue({
              items: [
                {
                  id: 1,
                  bizType: 'quote',
                  bizId: 100,
                  operationType: 'create',
                  operatorId: 10,
                  beforeData: null,
                  afterData: { quoteNo: 'Q-100' },
                  createdAt: '2026-07-13T08:00:00.000Z',
                },
              ],
            }),
          },
        },
        {
          provide: InquiryService,
          useValue: {
            listAuditLogs: jest.fn().mockResolvedValue({
              items: [
                {
                  id: 2,
                  bizType: 'inquiry',
                  bizId: 200,
                  operationType: 'submit',
                  operatorId: 11,
                  beforeData: null,
                  afterData: { inquiryNo: 'I-200' },
                  createdAt: '2026-07-13T09:00:00.000Z',
                },
              ],
            }),
          },
        },
        {
          provide: SampleOrderService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: SalesOrderService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: PurchaseOrderService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: ShipmentBatchService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: AfterSalesService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: CounterpartyService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: ProductService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: UserManagementService,
          useValue: userManagementServiceMock,
        },
      ],
    }).compile();

    const service = moduleRef.get(AuditService);
    const result = await service.list();

    expect(result.modules).toEqual([
      { key: 'quotes', label: '报价 Quote', count: 1, failed: false },
      { key: 'quote-inquiries', label: '询价 Inquiry', count: 1, failed: false },
      { key: 'samples', label: '样品 Sample', count: 0, failed: false },
      { key: 'sales-orders', label: '销售单 Sales Order', count: 0, failed: false },
      { key: 'purchase-orders', label: '采购单 Purchase Order', count: 0, failed: false },
      { key: 'shipment-batches', label: '发货批次 Shipment', count: 0, failed: false },
      { key: 'after-sales', label: '售后 After-sales', count: 0, failed: false },
      { key: 'counterparties', label: '往来单位 Counterparty', count: 0, failed: false },
      { key: 'products', label: '商品 Product', count: 0, failed: false },
    ]);
    expect(
      result.items.map(
        (item: { moduleLabel: string; bizType: string }) =>
          `${item.moduleLabel}:${item.bizType}`,
      ),
    ).toEqual(['询价 Inquiry:inquiry', '报价 Quote:quote']);
    expect(result.items[0]).toMatchObject({
      moduleKey: 'quote-inquiries',
      moduleLabel: '询价 Inquiry',
      bizType: 'inquiry',
      operatorName: 'Leo',
    });
  });

  it('keeps healthy module logs when one audited module fails to load', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: QuoteService,
          useValue: {
            listAuditLogs: jest.fn().mockResolvedValue({
              items: [
                {
                  id: 1,
                  bizType: 'quote',
                  bizId: 100,
                  operationType: 'create',
                  operatorId: 10,
                  beforeData: null,
                  afterData: { quoteNo: 'Q-100' },
                  createdAt: '2026-07-13T08:00:00.000Z',
                },
              ],
            }),
          },
        },
        {
          provide: InquiryService,
          useValue: {
            listAuditLogs: jest.fn().mockRejectedValue(new Error('inquiry down')),
          },
        },
        {
          provide: SampleOrderService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: SalesOrderService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: PurchaseOrderService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: ShipmentBatchService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: AfterSalesService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: CounterpartyService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: ProductService,
          useValue: { listAuditLogs: jest.fn().mockResolvedValue({ items: [] }) },
        },
        {
          provide: UserManagementService,
          useValue: userManagementServiceMock,
        },
      ],
    }).compile();

    const service = moduleRef.get(AuditService);
    const result = await service.list();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      moduleKey: 'quotes',
      bizType: 'quote',
      operatorName: 'Zoe',
    });
    expect(result.modules.find((module) => module.key === 'quote-inquiries')).toEqual({
      key: 'quote-inquiries',
      label: '询价 Inquiry',
      count: 0,
      failed: true,
    });
  });
});
