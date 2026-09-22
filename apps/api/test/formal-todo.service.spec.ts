import { FormalTodoService } from '../src/todo/formal-todo.service';

function createListResponse<T>(items: T[]) {
  return {
    items,
    page: 1,
    pageSize: 100,
    total: items.length,
    appliedFilters: {},
  };
}

describe('FormalTodoService', () => {
  it('aggregates open todos from quote, sales, purchase, shipment, and after-sales lists', async () => {
    const service = new FormalTodoService(
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'Q-RUNTIME-001',
              title: 'Runtime quote',
              bossConfirmed: false,
              createdBy: 'Zoe',
              detailHref: '/quotes/77',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'S-RUNTIME-001',
              title: 'Runtime sales',
              status: 'pending_sales_manager_approval',
              ownerName: 'Zoe',
              createdBy: 'Zoe',
              detailHref: '/sales-orders/88',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'P-RUNTIME-001',
              title: 'Runtime purchase',
              status: 'pending_purchase_manager_approval',
              ownerName: 'Leo',
              createdBy: 'Leo',
              detailHref: '/purchase-orders/99',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'SH-RUNTIME-001',
              title: 'Runtime shipment',
              hasException: true,
              receiptSendStatus: 'pending',
              ownerName: 'Leo',
              detailHref: '/shipment-batches/66',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'AS-RUNTIME-001',
              title: 'Runtime after-sales',
              status: 'pending_approval',
              financeReviewStatus: 'pending',
              ownerName: 'Leo',
              detailHref: '/after-sales/55',
            },
          ]),
        ),
      } as never,
    );

    const result = await service.listFormalTodos();

    expect(result.items.map((item) => item.docNo)).toEqual([
      'Q-RUNTIME-001',
      'S-RUNTIME-001',
      'P-RUNTIME-001',
      'SH-RUNTIME-001',
      'AS-RUNTIME-001',
    ]);
    expect(result.items[0]).toMatchObject({
      domain: 'sales',
      href: '/app/sales/quotes/77',
      priority: 'high',
    });
    expect(result.total).toBe(5);
  });

  it('filters formal todos by role and current owner for sales and purchase users', async () => {
    const service = new FormalTodoService(
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'Q-ZOE-001',
              title: 'Zoe quote',
              bossConfirmed: false,
              createdBy: 'Zoe',
              detailHref: '/quotes/1',
            },
            {
              docNo: 'Q-MIA-001',
              title: 'Mia quote',
              bossConfirmed: false,
              createdBy: 'Mia',
              detailHref: '/quotes/2',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'S-ZOE-001',
              title: 'Zoe sales',
              status: 'pending_sales_manager_approval',
              ownerName: 'Zoe',
              createdBy: 'Zoe',
              detailHref: '/sales-orders/1',
            },
            {
              docNo: 'S-MIA-001',
              title: 'Mia sales',
              status: 'pending_sales_manager_approval',
              ownerName: 'Mia',
              createdBy: 'Mia',
              detailHref: '/sales-orders/2',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'P-LEO-001',
              title: 'Leo purchase',
              status: 'pending_purchase_manager_approval',
              ownerName: 'Leo',
              createdBy: 'Leo',
              detailHref: '/purchase-orders/1',
            },
            {
              docNo: 'P-AMY-001',
              title: 'Amy purchase',
              status: 'pending_purchase_manager_approval',
              ownerName: 'Amy',
              createdBy: 'Amy',
              detailHref: '/purchase-orders/2',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'SH-LEO-001',
              title: 'Leo shipment',
              hasException: true,
              receiptSendStatus: 'sent',
              ownerName: 'Leo',
              detailHref: '/shipment-batches/1',
            },
            {
              docNo: 'SH-AMY-001',
              title: 'Amy shipment',
              hasException: false,
              receiptSendStatus: 'pending',
              ownerName: 'Amy',
              detailHref: '/shipment-batches/2',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'AS-LEO-001',
              title: 'Leo after-sales',
              status: 'pending_approval',
              financeReviewStatus: 'pending',
              ownerName: 'Leo',
              detailHref: '/after-sales/1',
            },
          ]),
        ),
      } as never,
    );

    await expect(
      service.listFormalTodos({ role: 'sales', user: 'Zoe' }),
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({ docNo: 'Q-ZOE-001' }),
        expect.objectContaining({ docNo: 'S-ZOE-001' }),
      ],
      total: 2,
    });

    await expect(
      service.listFormalTodos({ role: 'purchase', user: 'Leo' }),
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({ docNo: 'P-LEO-001' }),
        expect.objectContaining({ docNo: 'SH-LEO-001' }),
        expect.objectContaining({ docNo: 'AS-LEO-001' }),
      ],
      total: 3,
    });
  });

  it('counts auto-closed source todos separately from open todos', async () => {
    const service = new FormalTodoService(
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'Q-OPEN-001',
              title: 'Open quote',
              bossConfirmed: false,
              createdBy: 'Zoe',
              detailHref: '/quotes/1',
            },
            {
              docNo: 'Q-CLOSED-001',
              title: 'Closed quote',
              bossConfirmed: false,
              createdBy: 'Zoe',
              detailHref: '/quotes/2',
              lifecycleStatus: 'auto_closed',
              closeReason: 'Quote voided',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(createListResponse([])),
      } as never,
      {
        list: jest.fn().mockResolvedValue(createListResponse([])),
      } as never,
      {
        list: jest.fn().mockResolvedValue(createListResponse([])),
      } as never,
      {
        list: jest.fn().mockResolvedValue(createListResponse([])),
      } as never,
    );

    const result = await service.listFormalTodos();

    expect(result.items.map((item) => item.docNo)).toEqual(['Q-OPEN-001']);
    expect(result.closedTotal).toBe(1);
    expect(result.total).toBe(1);
  });

  it('creates todos from inquiry and sample order statuses', async () => {
    const service = new (FormalTodoService as new (...args: unknown[]) => FormalTodoService)(
      {
        list: jest.fn().mockResolvedValue(createListResponse([])),
      } as never,
      {
        list: jest.fn().mockResolvedValue(createListResponse([])),
      } as never,
      {
        list: jest.fn().mockResolvedValue(createListResponse([])),
      } as never,
      {
        list: jest.fn().mockResolvedValue(createListResponse([])),
      } as never,
      {
        list: jest.fn().mockResolvedValue(createListResponse([])),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              inquiryNo: 'IQ-RUNTIME-001',
              quoteOrderNo: 'Q-RUNTIME-001',
              status: 'pending_boss_review',
              customerName: 'Runtime Customer',
              createdBy: 'Zoe',
              detailHref: '/app/sales/inquiries/12',
            },
          ]),
        ),
      } as never,
      {
        list: jest.fn().mockResolvedValue(
          createListResponse([
            {
              docNo: 'SP-APPROVAL-001',
              title: 'Sample approval',
              status: 'pending_approval',
              ownerName: 'Zoe',
              detailHref: '/samples/21',
            },
            {
              docNo: 'SP-SAMPLING-001',
              title: 'Sample execution',
              status: 'pending_sampling',
              ownerName: 'Zoe',
              detailHref: '/samples/22',
            },
            {
              docNo: 'SP-SENT-001',
              title: 'Sample sent',
              status: 'sample_sent',
              ownerName: 'Zoe',
              detailHref: '/samples/23',
            },
          ]),
        ),
      } as never,
    );

    const result = await service.listFormalTodos({ role: 'sales_manager', user: 'Mia' });

    expect(result.items.map((item) => item.docNo)).toEqual([
      'IQ-RUNTIME-001',
      'SP-APPROVAL-001',
      'SP-SAMPLING-001',
      'SP-SENT-001',
    ]);
    expect(result.items).toEqual([
      expect.objectContaining({
        title: '询价待老板确认',
        href: '/app/sales/inquiries/12',
        priority: 'high',
      }),
      expect.objectContaining({
        title: '样品单待审批',
        href: '/app/sales/samples/21',
        priority: 'high',
      }),
      expect.objectContaining({
        title: '样品单待打样',
        href: '/app/sales/samples/22',
        priority: 'medium',
      }),
      expect.objectContaining({
        title: '样品待客户确认',
        href: '/app/sales/samples/23',
        priority: 'medium',
      }),
    ]);
  });
});
