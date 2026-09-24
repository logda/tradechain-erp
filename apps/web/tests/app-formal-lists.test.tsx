import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppQuoteListPage from '../app/app/sales/quotes/page';
import AppSalesOrdersPage from '../app/app/sales/orders/page';
import AppSampleOrdersPage from '../app/app/sales/samples/page';

describe('formal sales list pages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the formal quote list shell from the live quote API', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/quote-sources')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { code: 'online', label: '线上', enabled: true, sortOrder: 1 },
              { code: 'tiktok', label: 'TikTok', enabled: true, sortOrder: 2 },
            ],
          }),
        });
      }

      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                bizType: 'quote',
                bizId: 77,
                operationType: 'create_quote',
                operatorId: 2001,
                beforeData: null,
                afterData: { quoteNo: 'Q-RUNTIME-001' },
                createdAt: '2026-07-13T08:00:00.000Z',
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              moduleLabel: '需求单',
              documentType: 'demand',
              quoteId: 77,
              docNo: 'XQ-RUNTIME-001',
              title: 'Runtime API Demand',
              status: 'boss_approved',
              currentVersionNo: 1,
              secondaryStatus: undefined,
              customerName: 'Runtime Customer EN',
              customerFullName: '上海星河贸易有限公司',
              customerId: 1001,
              salesUserId: 2001,
              createdBy: 'Zoe',
              sourceType: 'website',
              inquiryDate: '2026-07-12',
              destination: 'Hamburg',
              requirements: 'Need product-library item',
              bossConfirmed: false,
              createdAt: '2026-07-12T08:00:00.000Z',
              detailHref: '/quotes/77',
            },
          ],
          total: 25,
          page: 1,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<>{await AppQuoteListPage({ searchParams: Promise.resolve({}) })}</>);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:3001/api/quotes'),
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: '正式需求和报价' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute(
      'href',
      '/app/sales',
    );
    expect(screen.getByRole('link', { name: '新建需求/报价' })).toHaveAttribute(
      'href',
      '/app/sales/quotes/new',
    );
    expect(screen.getByText('当前筛选')).toBeInTheDocument();
    expect(screen.getByLabelText('单据类型 Document Type')).toBeInTheDocument();
    expect(screen.getByLabelText('单号 Doc No')).toBeInTheDocument();
    expect(screen.getByLabelText('创建人 / 销售 Created By')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toHaveClass(
      'erp-button',
      'erp-button--primary',
    );
    expect(screen.getByLabelText('单号 Doc No')).toHaveClass('erp-control');
    expect(screen.getByText('查询结果')).toBeInTheDocument();
    expect(screen.getByText('XQ-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByText('类型 Type')).toBeInTheDocument();
    expect(screen.getByText('上海星河贸易有限公司 / Runtime Customer EN')).toBeInTheDocument();
    const quoteDetailLink = screen.getByRole('link', { name: '查看详情' });
    expect(quoteDetailLink).toHaveClass('erp-button--compact', 'erp-row-action');
    const quoteRow = quoteDetailLink.closest('tr');
    expect(quoteRow).not.toBeNull();
    expect(within(quoteRow as HTMLTableRowElement).getByText('需求单 / Demand')).toBeInTheDocument();
    expect(
      within(quoteRow as HTMLTableRowElement).getByText(
        (_, element) =>
          element?.tagName === 'TD' &&
          (element.textContent?.includes('boss_approved') ?? false),
      ),
    ).toBeInTheDocument();
    expect(within(quoteRow as HTMLTableRowElement).getByRole('button', { name: '转销售单' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'TikTok / tiktok' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(
      quoteDetailLink,
    ).toHaveAttribute('href', '/app/sales/quotes/77');
  });

  it('keeps quote list filters aligned with displayed business fields', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/quote-sources')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppQuoteListPage({
          searchParams: Promise.resolve({
            documentType: 'demand',
            docNo: 'Q-RUNTIME-001',
            createdBy: 'Zoe',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('documentType=demand'),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('docNo=Q-RUNTIME-001'),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('createdBy=Zoe'),
      expect.anything(),
    );
    expect(screen.getByText('单据类型: 需求单 / Demand')).toBeInTheDocument();
    expect(screen.getByText('单号: Q-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByText('创建人 / 销售: Zoe')).toBeInTheDocument();
  });

  it('renders quote pagination and keeps source values out of the status column', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/quote-sources')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { code: 'online', label: '线上', enabled: true, sortOrder: 1 },
              { code: 'tiktok', label: 'TikTok', enabled: true, sortOrder: 2 },
            ],
          }),
        });
      }

      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              moduleLabel: '报价单',
              documentType: 'quote',
              docNo: 'Q-PAGE-001',
              title: 'Paged Quote',
              status: 'draft',
              secondaryStatus: 'tiktok',
              customerName: 'Paged Customer',
              customerFullName: '分页测试客户有限公司',
              createdBy: 'Zoe',
              sourceType: 'tiktok',
              bossConfirmed: false,
              createdAt: '2026-07-21T08:00:00.000Z',
              detailHref: '/quotes/101',
            },
          ],
          total: 25,
          page: 1,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<>{await AppQuoteListPage({ searchParams: Promise.resolve({}) })}</>);

    expect(
      screen.getByRole('navigation', { name: '需求和报价分页' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute(
      'href',
      '/app/sales/quotes?page=2&pageSize=20',
    );

    const quoteRow = screen.getByRole('link', { name: '查看详情' }).closest('tr');
    expect(quoteRow).not.toBeNull();
    const cells = within(quoteRow as HTMLTableRowElement).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('报价单 / Quote');
    expect(cells[2]).toHaveTextContent('draft / 草稿');
    expect(cells[2]).not.toHaveTextContent('tiktok');
    expect(cells[3]).toHaveTextContent('分页测试客户有限公司 / Paged Customer');
    expect(cells[4]).toHaveTextContent('-');
  });

  it('keeps rendering the live quote list when the API requires a signed formal session', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.includes('/quote-sources')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [{ code: 'online', label: '线上', enabled: true, sortOrder: 1 }],
            }),
          });
        }

        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        const headers = (init?.headers ?? {}) as Record<string, string | undefined>;
        if (!headers['x-erp-session'] || !headers['x-erp-session-signature']) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: async () => ({ message: '正式模式要求签名会话' }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                moduleLabel: '报价单',
                documentType: 'quote',
                docNo: 'Q-DRAFT-9001',
                title: 'Signed Draft Quote',
                status: 'draft',
                secondaryStatus: 'online',
                customerName: 'Signed Draft Customer',
                customerFullName: '上海已签名草稿客户有限公司',
                createdBy: 'Zoe',
                sourceType: 'online',
                bossConfirmed: false,
                createdAt: '2026-07-19T09:30:00.000Z',
                detailHref: '/quotes/9001',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<>{await AppQuoteListPage({ searchParams: Promise.resolve({}) })}</>);

    expect(screen.getByText('Q-DRAFT-9001')).toBeInTheDocument();
    expect(
      screen.getByText('上海已签名草稿客户有限公司 / Signed Draft Customer'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Q202607080001')).not.toBeInTheDocument();
  });

  it('renders the formal sales list shell from the live sales-order API', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                bizType: 'sales_order',
                bizId: 88,
                operationType: 'create_sales_order',
                operatorId: 2001,
                beforeData: null,
                afterData: { salesNo: 'S-RUNTIME-001' },
                createdAt: '2026-07-13T08:00:00.000Z',
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              moduleLabel: '销售单',
              docNo: 'S-RUNTIME-001',
              title: 'Runtime API Sales Order',
              status: 'purchasing',
              secondaryStatus: 'deposit_received',
              counterpartyName: 'Runtime Customer',
              customerOrderNo: 'PO-RUNTIME-001',
              storeName: 'Runtime Store 02',
              orderDate: '2026-07-12',
              estimatedDeliveryDate: '2026-08-12',
              ownerName: 'Zoe',
              createdAt: '2026-07-12T08:00:00.000Z',
              detailHref: '/sales-orders/88',
              createdBy: 'Zoe',
              approvalStatus: 'approved',
              fulfillmentStatus: 'purchasing',
              receiptStatus: 'deposit_received',
              financeConfirmStatus: 'pending',
              hasAfterSales: true,
              sourceSummary: 'from_quote_with_inquiry',
            },
          ],
          total: 25,
          page: 1,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>{await AppSalesOrdersPage({ searchParams: Promise.resolve({}) })}</>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:3001/api/sales-orders'),
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: '正式销售单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute(
      'href',
      '/app/sales',
    );
    expect(screen.getByRole('link', { name: '新建销售单' })).toHaveAttribute(
      'href',
      '/app/sales/orders/new',
    );
    expect(screen.getByRole('link', { name: '从报价转入' })).toHaveAttribute(
      'href',
      '/app/sales/quotes',
    );
    expect(screen.getByText('当前筛选')).toBeInTheDocument();
    expect(screen.getByText('查询结果')).toBeInTheDocument();
    expect(screen.getByText('S-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByText('Runtime API Sales Order')).toBeInTheDocument();
    expect(screen.getByText('运行时客户 / Runtime Customer')).toBeInTheDocument();
    expect(screen.getByText('销售单状态 Status')).toBeInTheDocument();
    expect(screen.queryByText('审批 / 履约')).not.toBeInTheDocument();
    expect(screen.queryByText('财务 / 售后')).not.toBeInTheDocument();
    expect(screen.getByText('purchasing / 采购中')).toBeInTheDocument();
    expect(screen.getByText(/PO-RUNTIME-001/)).toBeInTheDocument();
    expect(screen.getByText(/Runtime Store 02/)).toBeInTheDocument();
    expect(screen.getByText('订货日期 / 截止日期')).toBeInTheDocument();
    expect(screen.getByText('订货：')).toBeInTheDocument();
    expect(screen.getByText('截止：')).toBeInTheDocument();
    expect(screen.getByText(/2026-07-12/)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-12/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: '销售单分页' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute(
      'href',
      '/app/sales/orders?page=2&pageSize=20',
    );
    expect(screen.getByRole('link', { name: '50' })).toHaveAttribute(
      'href',
      '/app/sales/orders?page=1&pageSize=50',
    );
    expect(
      screen.getByRole('link', { name: '按来源方式筛选 报价+询价转入' }),
    ).toHaveAttribute(
      'href',
      '/app/sales/orders?sourceMode=from_quote_with_inquiry',
    );
    expect(
      screen.getByRole('link', { name: '查看详情 S-RUNTIME-001' }),
    ).toHaveAttribute('href', '/app/sales/orders/88');
  });

  it('renders demand-converted sales source wording and filter link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/audit-logs')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                moduleLabel: '销售单',
                docNo: 'S-DEMAND-001',
                title: '需求转销售单',
                status: 'draft',
                counterpartyName: 'Demand Customer',
                ownerName: 'Zoe',
                createdAt: '2026-08-12T08:00:00.000Z',
                detailHref: '/sales-orders/123',
                createdBy: 'Zoe',
                approvalStatus: 'draft',
                fulfillmentStatus: 'draft',
                receiptStatus: 'unpaid',
                financeConfirmStatus: 'pending',
                hasAfterSales: false,
                sourceSummary: 'DEMAND / 需求转单',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      }),
    );

    render(
      <>{await AppSalesOrdersPage({ searchParams: Promise.resolve({}) })}</>,
    );

    expect(screen.getByText('DEMAND / 需求转单')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '按来源方式筛选 需求转入' }),
    ).toHaveAttribute(
      'href',
      '/app/sales/orders?sourceMode=from_demand',
    );
  });

  it('renders sales finance filters and applied chips', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('preview fallback')));

    render(
      <>
        {await AppSalesOrdersPage({
          searchParams: Promise.resolve({
            receiptStatus: 'deposit_received',
            financeConfirmStatus: 'pending',
          }),
        })}
      </>,
    );

    expect(screen.getByLabelText('收款状态 Receipt')).toBeInTheDocument();
    expect(screen.getByLabelText('财务确认 Finance')).toBeInTheDocument();
    expect(screen.getByText('receiptStatus: deposit_received')).toBeInTheDocument();
    expect(screen.getByText('financeConfirmStatus: pending')).toBeInTheDocument();
    expect(screen.queryByText('S202607080001')).not.toBeInTheDocument();
    expect(screen.getByText('S202607080002')).toBeInTheDocument();
    expect(screen.getByText('S202607080003')).toBeInTheDocument();
  });

  it('renders the formal sample order list shell from the live sample API', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                bizType: 'sample_order',
                bizId: 66,
                operationType: 'create_sample_order',
                operatorId: 2001,
                beforeData: null,
                afterData: { sampleNo: 'SP-RUNTIME-001' },
                createdAt: '2026-07-13T08:00:00.000Z',
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              moduleLabel: '样品单',
              docNo: 'SP-RUNTIME-001',
              title: 'Runtime API Sample',
              status: 'draft',
              secondaryStatus: 'quote_confirmed',
              customerName: 'Runtime Customer',
              createdBy: 'Zoe',
              ownerName: 'Zoe',
              quoteNo: 'Q-RUNTIME-001',
              isReplacement: true,
              isCancelled: false,
              createdAt: '2026-07-12T08:00:00.000Z',
              detailHref: '/samples/66',
            },
          ],
          total: 25,
          page: 1,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppSampleOrdersPage({
          searchParams: Promise.resolve({
            docNo: 'SP-RUNTIME-001',
            quoteNo: 'Q-RUNTIME-001',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:3001/api/samples'),
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: '正式样品单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute(
      'href',
      '/app/sales',
    );
    expect(
      screen.queryByRole('link', { name: '查看演示样品页' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('当前筛选')).toBeInTheDocument();
    expect(screen.getByLabelText('样品单号 Sample No')).toBeInTheDocument();
    expect(screen.getByLabelText('来源报价单号 Quote No')).toBeInTheDocument();
    expect(screen.getByText('样品单号: SP-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByText('来源报价单号: Q-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByText('查询结果')).toBeInTheDocument();
    expect(screen.getByText('SP-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByText('Q-RUNTIME-001')).toBeInTheDocument();
    const sampleRow = screen
      .getByRole('link', { name: '查看详情 SP-RUNTIME-001' })
      .closest('tr');
    expect(sampleRow).not.toBeNull();
    const sampleCells = within(sampleRow as HTMLTableRowElement).getAllByRole('cell');
    expect(sampleCells[1]).toHaveTextContent('2026-07-12');
    expect(sampleCells[4]).toHaveTextContent('draft / 草稿');
    expect(sampleCells[4]).not.toHaveTextContent('quote_confirmed');
    expect(sampleCells[4]).not.toHaveTextContent('未知状态');
    expect(
      screen.getByRole('navigation', { name: '样品单分页' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute(
      'href',
      '/app/sales/samples?docNo=SP-RUNTIME-001&quoteNo=Q-RUNTIME-001&page=2&pageSize=20',
    );
    expect(screen.getByRole('heading', { name: '审计日志' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看详情 SP-RUNTIME-001' }),
    ).toHaveAttribute('href', '/app/sales/samples/66');
  });

  it('allows purchase users to open the formal sample list from the purchase board', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [] }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              moduleLabel: '样品单',
              docNo: 'SP-PURCHASE-001',
              title: '采购执行样品',
              status: 'sampling',
              secondaryStatus: 'sampling',
              customerName: 'Runtime Customer',
              createdBy: 'Zoe',
              ownerName: 'Leo',
              quoteNo: 'Q-RUNTIME-001',
              isReplacement: false,
              isCancelled: false,
              createdAt: '2026-07-12T08:00:00.000Z',
              detailHref: '/samples/77',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppSampleOrdersPage({
          searchParams: Promise.resolve({ role: 'purchase', user: 'Leo' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式样品单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回工作台' })).toHaveAttribute(
      'href',
      '/app/purchase',
    );
    expect(screen.getByText('SP-PURCHASE-001')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看详情 SP-PURCHASE-001' }),
    ).toHaveAttribute('href', '/app/sales/samples/77');
  });
});
