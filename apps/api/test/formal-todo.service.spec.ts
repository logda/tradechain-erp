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
  it('creates a boss todo only for a quote at the boss approval node', async () => {
    const empty = { list: jest.fn().mockResolvedValue(createListResponse([])) };
    const quote = { list: jest.fn().mockResolvedValue(createListResponse([
      { docNo: 'Q-DRAFT', title: '草稿', status: 'draft', bossConfirmed: false,
        createdBy: 'Zoe', detailHref: '/quotes/1' },
      { docNo: 'Q-BOSS', title: '待批', status: 'pending_boss_price_confirmation', bossConfirmed: false,
        createdBy: 'Zoe', detailHref: '/quotes/2', createdAt: '2026-09-25T10:00:00.000Z' },
    ])) };
    const service = new FormalTodoService(quote as never, empty as never, empty as never,
      empty as never, empty as never);
    const result = await service.listFormalTodos({ role: 'boss', user: 'Mia' });
    expect(result.items.map((item) => item.docNo)).toEqual(['Q-BOSS']);
    expect(result.items[0]).toMatchObject({ createdAt: '2026-09-25T10:00:00.000Z' });
  });

  it('returns newest purchase tasks with product, supplier and image from the order snapshot', async () => {
    const empty = { list: jest.fn().mockResolvedValue(createListResponse([])) };
    const purchase = {
      list: jest.fn().mockResolvedValue(createListResponse([
        { docNo: 'P-OLDER', title: '台灯采购', status: 'pending_purchase_manager_approval',
          supplierName: '甲厂', createdAt: '2026-09-24T10:00:00.000Z', detailHref: '/purchase-orders/101' },
        { docNo: 'P-NEWER', title: '风扇采购', status: 'pending_purchase_manager_approval',
          supplierName: '乙厂', createdAt: '2026-09-25T10:00:00.000Z', detailHref: '/purchase-orders/102' },
      ])),
      getDetail: jest.fn().mockImplementation(async (id: number) => ({
        items: [{ productName: id === 102 ? '风扇' : '台灯', imageUrls: [`/uploads/${id}.png`] }],
      })),
    };
    const service = new FormalTodoService(empty as never, empty as never, purchase as never,
      empty as never, empty as never);
    const result = await service.listFormalTodos({ role: 'purchase_manager', user: 'Mia' });
    expect(result.items.map((item) => item.docNo)).toEqual(['P-NEWER', 'P-OLDER']);
    expect(result.items[0]).toMatchObject({
      supplierName: '乙厂', productNames: ['风扇'], imageUrls: ['/uploads/102.png'],
    });
  });

  it('moves follow-up tasks to the current workflow node and clears finance tasks outside finance review', async () => {
    const empty = { list: jest.fn().mockResolvedValue(createListResponse([])) };
    const quote = { list: jest.fn().mockResolvedValue(createListResponse([
      { docNo: 'Q-FEEDBACK', title: '风扇报价', status: 'pending_customer_feedback',
        bossConfirmed: true, createdBy: 'Zoe', detailHref: '/quotes/1' },
    ])) };
    const sales = { ...empty, listPendingPurchaseAssignments: jest.fn().mockResolvedValue([]),
      list: jest.fn().mockResolvedValue(createListResponse([
        { docNo: 'S-REJECTED', title: '台灯销售', status: 'rejected', ownerName: 'Zoe',
          createdBy: 'Zoe', detailHref: '/sales-orders/2' },
      ])) };
    const afterSales = { list: jest.fn().mockResolvedValue(createListResponse([
      { docNo: 'AS-DRAFT', title: '退货草稿', status: 'pending_submit',
        financeReviewStatus: 'pending', ownerName: 'Leo', detailHref: '/after-sales/3' },
      { docNo: 'AS-FINANCE', title: '退货复核', status: 'finance_reviewing',
        financeReviewStatus: 'pending', ownerName: 'Leo', detailHref: '/after-sales/4' },
    ])) };
    const service = new FormalTodoService(quote as never, sales as never, empty as never,
      empty as never, afterSales as never);
    const result = await service.listFormalTodos({ role: 'boss', user: 'Mia' });
    expect(result.items.map((item) => item.docNo)).toEqual(['Q-FEEDBACK', 'S-REJECTED', 'AS-FINANCE']);
    expect(result.items[0]).toMatchObject({ title: '报价待客户反馈', ownerName: 'Zoe' });
  });

  it('routes inquiry work to purchase and sample approval to sales while sampling moves to purchase', async () => {
    const empty = { list: jest.fn().mockResolvedValue(createListResponse([])) };
    const inquiry = { list: jest.fn().mockResolvedValue(createListResponse([
      { inquiryNo: 'IQ-WORK', quoteOrderNo: 'Q1', status: 'pending_inquiry',
        customerName: '星河', createdBy: 'Zoe', detailHref: '/inquiries/1', items: [] },
    ])) };
    const sample = { list: jest.fn().mockResolvedValue(createListResponse([
      { docNo: 'SP-APPROVE', title: '待审批样品', status: 'pending_approval', ownerName: 'Zoe',
        detailHref: '/samples/2' },
      { docNo: 'SP-SAMPLING', title: '待打样样品', status: 'pending_sampling', ownerName: 'Zoe',
        detailHref: '/samples/3' },
    ])) };
    const service = new (FormalTodoService as new (...args: unknown[]) => FormalTodoService)(
      empty, empty, empty, empty, empty, inquiry, sample,
    );
    const purchase = await service.listFormalTodos({ role: 'purchase', user: 'Leo' });
    expect(purchase.items.map((item) => item.docNo)).toEqual(['IQ-WORK', 'SP-SAMPLING']);
    const sales = await service.listFormalTodos({ role: 'sales_manager', user: 'Mia' });
    expect(sales.items.map((item) => item.docNo)).toEqual(['SP-APPROVE']);
  });

  it('assigns after-sales approval to the manager and finance confirmation to the boss', async () => {
    const empty = { list: jest.fn().mockResolvedValue(createListResponse([])) };
    const afterSales = { list: jest.fn().mockResolvedValue(createListResponse([
      { docNo: 'AS-APPROVE', title: '待审批售后', status: 'pending_approval',
        financeReviewStatus: 'pending', ownerName: 'Leo', detailHref: '/after-sales/1' },
      { docNo: 'AS-FINANCE', title: '待财务售后', status: 'finance_reviewing',
        financeReviewStatus: 'pending', ownerName: 'Leo', detailHref: '/after-sales/2' },
    ])) };
    const service = new FormalTodoService(empty as never, empty as never, empty as never,
      empty as never, afterSales as never);
    expect((await service.listFormalTodos({ role: 'purchase_manager', user: 'Mia' })).items
      .map((item) => item.docNo)).toEqual(['AS-APPROVE']);
    expect((await service.listFormalTodos({ role: 'purchase', user: 'Leo' })).items).toEqual([]);
    expect((await service.listFormalTodos({ role: 'boss', user: 'Admin' })).items
      .map((item) => item.docNo)).toEqual(['AS-APPROVE', 'AS-FINANCE']);
  });

  it('shows an ETA reminder to the assigned purchaser from three days before delivery until fully shipped', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T12:00:00.000Z'));
    try {
      const empty = { list: jest.fn().mockResolvedValue(createListResponse([])) };
      const purchase = { list: jest.fn().mockResolvedValue(createListResponse([
        { docNo: 'C-DUE', title: '风扇采购', status: 'purchasing', ownerName: 'Leo',
          factoryEstimatedDeliveryDate: '2026-09-28', detailHref: '/purchase-orders/101' },
        { docNo: 'C-LATER', title: '台灯采购', status: 'purchasing', ownerName: 'Leo',
          factoryEstimatedDeliveryDate: '2026-09-29', detailHref: '/purchase-orders/102' },
        { docNo: 'C-PARTIAL', title: '部分发货采购', status: 'partial_shipped', ownerName: 'Leo',
          factoryEstimatedDeliveryDate: '2026-09-24', detailHref: '/purchase-orders/103' },
        { docNo: 'C-SHIPPED', title: '已发货采购', status: 'shipped', ownerName: 'Leo',
          factoryEstimatedDeliveryDate: '2026-09-28', detailHref: '/purchase-orders/104' },
        { docNo: 'C-OTHER', title: '其他人采购', status: 'purchasing', ownerName: 'Nina',
          factoryEstimatedDeliveryDate: '2026-09-28', detailHref: '/purchase-orders/105' },
      ])) };
      const service = new FormalTodoService(empty as never, empty as never, purchase as never,
        empty as never, empty as never);
      const result = await service.listFormalTodos({ role: 'purchase', user: 'Leo' });
      expect(result.items.filter((item) => item.title === '工厂交期提醒').map((item) => item.docNo))
        .toEqual(['C-DUE', 'C-PARTIAL']);

      purchase.list.mockResolvedValue(createListResponse([{
        docNo: 'C-DUE', title: '风扇采购', status: 'purchasing', ownerName: 'Leo',
        factoryEstimatedDeliveryDate: '2026-10-10', detailHref: '/purchase-orders/101',
      }]));
      expect((await service.listFormalTodos({ role: 'purchase', user: 'Leo' })).items)
        .not.toEqual(expect.arrayContaining([expect.objectContaining({ title: '工厂交期提醒' })]));
    } finally {
      jest.useRealTimers();
    }
  });

  it('routes an existing direct purchase claim awaiting assignment to the manager', async () => {
    const empty = { list: jest.fn().mockResolvedValue(createListResponse([])) };
    const purchase = {
      list: jest.fn().mockResolvedValue(createListResponse([{
        docNo: 'C-OLD-1', title: 'Old direct purchase', status: 'pending_purchase_claim',
        ownerName: 'Leo', detailHref: '/purchase-orders/501',
      }])),
      getDetail: jest.fn().mockResolvedValue({ needsPurchaseAssignment: true }),
    };
    const service = new FormalTodoService(empty as never, empty as never, purchase as never,
      empty as never, empty as never);
    const managerTodos = await service.listFormalTodos({ role: 'purchase_manager', user: 'Mia' });
    expect(managerTodos.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ docNo: 'C-OLD-1', ownerName: '', statusLabel: '待分配' }),
    ]));
    const ownerTodos = await service.listFormalTodos({ role: 'purchase', user: 'Leo' });
    expect(ownerTodos.items.some((item) => item.docNo === 'C-OLD-1')).toBe(false);
  });

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
              status: 'finance_reviewing',
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
              status: 'finance_reviewing',
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
        expect.objectContaining({ docNo: 'SH-LEO-001' }),
      ],
      total: 1,
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
        title: '样品待客户确认',
        href: '/app/sales/samples/23',
        priority: 'medium',
      }),
    ]);
  });
});
