import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function buildSourceQuoteFixture(detail: unknown) {
  const inquiry = detail as {
    quoteOrderId?: number;
    quoteOrderNo?: string;
    quoteVersionNo?: number;
    customerName?: string;
    customerFullName?: string | null;
    items?: Array<{
      lineNo?: number;
      sku?: string;
      productName?: string;
      imageUrls?: string[];
      confirmedSalePrice?: number;
    }>;
  };

  return {
    id: inquiry.quoteOrderId ?? 1,
    quoteNo: inquiry.quoteOrderNo ?? 'Q-RUNTIME-001',
    status: 'submitted',
    currentVersionNo: inquiry.quoteVersionNo ?? 1,
    customerId: 1,
    customerName: inquiry.customerFullName ?? inquiry.customerName ?? '测试客户',
    customerCode: 'CUST-RUNTIME',
    salesUserId: 2001,
    sourceCode: 'tiktok',
    requirements: '来源报价测试需求',
    items: (inquiry.items ?? []).map((item, index) => {
      const salePrice = Number(item.confirmedSalePrice ?? 0);

      return {
        lineNo: item.lineNo ?? index + 1,
        productId: index + 1,
        sku: item.sku ?? `SKU-${index + 1}`,
        productName: item.productName ?? `测试商品 ${index + 1}`,
        imageUrls: item.imageUrls ?? [],
        unit: 'pcs',
        quantity: 100,
        targetPrice: Number((salePrice * 0.9).toFixed(2)),
        salePrice,
        amount: Number((salePrice * 100).toFixed(2)),
      };
    }),
  };
}

function stubInquiryDetailFetch(detail: unknown) {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('/quote-inquiries/audit-logs')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [] }),
      });
    }

    if (url.includes('/formal-lookup/counterparties?type=supplier&status=active')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 2,
              type: 'supplier',
              code: 'SUP-BRAVO',
              name: 'Bravo Industrial',
              shortName: '光源制造',
              status: 'active',
            },
            {
              id: 3,
              type: 'both',
              code: 'CP-GLOBAL',
              name: 'Global Partner Ltd.',
              shortName: '环球伙伴',
              status: 'active',
            },
          ],
        }),
      });
    }

    if (url.includes('/quotes/')) {
      return Promise.resolve({
        ok: true,
        json: async () => buildSourceQuoteFixture(detail),
      });
    }

    if (url.includes('/quote-inquiries/')) {
      return Promise.resolve({
        ok: true,
        json: async () => detail,
      });
    }

    throw new Error(`Unexpected fetch url: ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('formal inquiry pages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the formal inquiry list shell from the live inquiry API', async () => {
    const { default: AppFormalInquiryPage } = await import(
      '../app/app/sales/inquiries/page'
    );
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                bizType: 'quote_inquiry',
                bizId: 88,
                operationType: 'create_quote_inquiry',
                operatorId: 2001,
                beforeData: null,
                afterData: { inquiryNo: 'IQ-RUNTIME-001' },
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
              id: 88,
              inquiryNo: 'IQ-RUNTIME-001',
              status: 'pending_boss_review',
              quoteOrderId: 101,
              quoteOrderNo: 'Q-RUNTIME-001',
              quoteVersionNo: 3,
              customerName: 'Runtime Customer EN',
              customerFullName: '上海星河贸易有限公司',
              createdBy: 'Zoe',
              supplierCount: 3,
              comparisonSummary: 'Runtime API inquiry item',
              createdAt: '2026-07-12T08:00:00.000Z',
              detailHref: '/app/sales/inquiries/88',
              items: [],
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
        {await AppFormalInquiryPage({
          searchParams: Promise.resolve({}),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:3001/api/quote-inquiries'),
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: '正式询价单' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式首页' }),
    ).toHaveAttribute('href', '/app');
    expect(
      screen.getByRole('link', { name: '返回销售中心' }),
    ).toHaveAttribute('href', '/app/sales');
    expect(
      screen.getByRole('link', { name: '进入需求/报价模块' }),
    ).toHaveAttribute('href', '/app/sales/quotes');
    expect(screen.getByText('IQ-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByLabelText('询价单号 Inquiry No')).toBeInTheDocument();
    expect(screen.getByLabelText('来源报价单号 Quote No')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toHaveClass(
      'erp-button',
      'erp-button--primary',
    );
    expect(screen.getByLabelText('询价单号 Inquiry No')).toHaveClass('erp-control');
    expect(screen.getByText('上海星河贸易有限公司 / Runtime Customer EN')).toBeInTheDocument();
    expect(screen.getByText('pending_boss_review / 待老板确认')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '审计日志' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看详情 IQ-RUNTIME-001' }),
    ).toHaveAttribute('href', '/app/sales/inquiries/88');
    expect(
      screen.getByRole('link', { name: '查看详情 IQ-RUNTIME-001' }),
    ).toHaveClass('erp-button--compact', 'erp-row-action');
  });

  it('keeps inquiry list filters aligned with inquiry and source quote fields', async () => {
    const { default: AppFormalInquiryPage } = await import(
      '../app/app/sales/inquiries/page'
    );
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
        {await AppFormalInquiryPage({
          searchParams: Promise.resolve({
            docNo: 'IQ-RUNTIME-001',
            quoteNo: 'Q-RUNTIME-001',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('docNo=IQ-RUNTIME-001'),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('quoteNo=Q-RUNTIME-001'),
      expect.anything(),
    );
    expect(screen.getByText('询价单号: IQ-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByText('来源报价单号: Q-RUNTIME-001')).toBeInTheDocument();
  });

  it('renders pagination for the formal inquiry list when there are more results', async () => {
    const { default: AppFormalInquiryPage } = await import(
      '../app/app/sales/inquiries/page'
    );
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
              id: 88,
              inquiryNo: 'IQ-RUNTIME-001',
              status: 'pending_inquiry',
              quoteOrderId: 101,
              quoteOrderNo: 'Q-RUNTIME-001',
              quoteVersionNo: 3,
              customerName: 'Runtime Customer EN',
              customerFullName: '上海星河贸易有限公司',
              createdBy: 'Zoe',
              supplierCount: 3,
              comparisonSummary: 'Runtime API inquiry item',
              createdAt: '2026-07-12T08:00:00.000Z',
              detailHref: '/app/sales/inquiries/88',
              items: [],
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
        {await AppFormalInquiryPage({
          searchParams: Promise.resolve({}),
        })}
      </>,
    );

    expect(
      screen.getByRole('navigation', { name: '询价单分页' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute(
      'href',
      '/app/sales/inquiries?page=2&pageSize=20',
    );
  });

  it('renders the formal inquiry detail page with boss confirmation actions', async () => {
    stubInquiryDetailFetch({
      id: 2,
      inquiryNo: 'IQ202607080002',
      status: 'pending_boss_review',
      quoteOrderId: 2,
      quoteOrderNo: 'Q202607080002',
      quoteVersionNo: 2,
      customerName: 'Bravo Retail',
      createdBy: 'Leo',
      supplierCount: 3,
      comparisonSummary: '比价已提交，等待老板确认最终售价。',
      createdAt: '2026-07-07T13:10:00.000Z',
      detailHref: '/app/sales/inquiries/2',
      items: [
        {
          itemId: 11,
          lineNo: 1,
          sku: 'SKU-PLUG-001',
          productName: '多孔插座',
          imageUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-plug.png',
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-plug-2.png',
          ],
          requiredSupplierCount: 2,
          supplierQuotes: [
            {
              supplierSourceMode: 'counterparty',
              supplierId: 2,
              supplierCode: 'SUP-BRAVO',
              supplierName: 'Bravo Industrial',
              purchasePrice: 19.6,
            },
            {
              supplierSourceMode: 'manual',
              supplierName: '东莞优联工厂',
              purchasePrice: 20.1,
            },
            {
              supplierSourceMode: 'manual',
              supplierName: '宁波海星电子',
              purchasePrice: 20.4,
            },
          ],
          confirmedSalePrice: 19.6,
        },
      ],
    });
    const { default: AppFormalInquiryDetailPage } = await import(
      '../app/app/sales/inquiries/[id]/page'
    );

    render(
      <>
        {await AppFormalInquiryDetailPage({
          params: Promise.resolve({ id: '2' }),
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式询价详情' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式询价列表' }),
    ).toHaveAttribute('href', '/app/sales/inquiries');
    expect(
      screen.getByRole('link', { name: '返回正式首页' }),
    ).toHaveAttribute('href', '/app');
    expect(
      screen.getByRole('link', { name: '返回销售中心' }),
    ).toHaveAttribute('href', '/app/sales');
    expect(
      screen.getByRole('link', { name: '打开源报价详情' }),
    ).toHaveAttribute('href', '/app/sales/quotes/2?fromInquiryId=2');
    expect(
      screen.getByRole('link', { name: '打开完整报价单' }),
    ).toHaveAttribute('href', '/app/sales/quotes/2?fromInquiryId=2');
    expect(
      screen.getByRole('heading', { name: '询价单 IQ202607080002' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('采购信息 Procurement')).not.toBeInTheDocument();
    expect(screen.queryByText('追溯字段 Trace')).not.toBeInTheDocument();
    expect(screen.getAllByText('客户：博瑞零售 / Bravo Retail')).toHaveLength(2);
    expect(screen.getByText('客户价 / 销售单价')).toBeInTheDocument();
    expect(screen.getByText('来源报价概览 Quote Overview')).toBeInTheDocument();
    expect(screen.getAllByText('图片').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('行 1 最终售价')).toHaveValue(19.6);
    expect(screen.getByText(/等待老板确认最终售价/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再次提交比价' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '老板确认' })).toBeInTheDocument();
    expect(
      screen.getByText(
        '当前状态动作：待询价可提交比价；待老板确认可确认最终售价；老板已确认后不再展示提交和确认入口。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Q202607080002')).toBeInTheDocument();
    expect(screen.getByText('报价版本：V2')).toBeInTheDocument();
    expect(screen.getAllByAltText('多孔插座 图片 1')[0]).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-plug.png',
    );
    expect(screen.getAllByAltText('多孔插座 图片 1')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: '查看 多孔插座 图片 1' })[0]);
    expect(
      screen.getByRole('dialog', { name: '多孔插座 图片预览' }),
    ).toBeInTheDocument();
    expect(screen.getByAltText('多孔插座 大图预览 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-plug.png',
    );
    expect(
      screen.getByRole('button', { name: '上一张' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '下一张' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一张' }));
    expect(screen.getByAltText('多孔插座 大图预览 2')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-plug-2.png',
    );
    fireEvent.click(screen.getByRole('button', { name: '上一张' }));
    expect(screen.getByAltText('多孔插座 大图预览 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-plug.png',
    );
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(
      screen.queryByRole('dialog', { name: '多孔插座 图片预览' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('行 1 供应商 1'),
    ).toHaveValue('SUP-BRAVO / 光源制造 / Bravo Industrial');
    expect(screen.getByLabelText('行 1 采购价 1')).toHaveValue(19.6);
    expect(screen.getByText('SUP-BRAVO / 光源制造 - 19.6')).toBeInTheDocument();
  });

  it('hides inquiry actions once the boss has already confirmed the inquiry', async () => {
    stubInquiryDetailFetch({
      id: 3,
      inquiryNo: 'IQ202607080003',
      status: 'boss_confirmed',
      quoteOrderId: 3,
      quoteOrderNo: 'Q202607080003',
      quoteVersionNo: 3,
      customerName: 'Acme Trading',
      createdBy: 'Zoe',
      supplierCount: 4,
      comparisonSummary: '老板已确认售价，可以回写报价版本并进入销售单转化。',
      createdAt: '2026-07-06T15:45:00.000Z',
      detailHref: '/app/sales/inquiries/3',
      items: [
        {
          itemId: 12,
          lineNo: 1,
          sku: 'SKU-LIGHT-002',
          productName: '室内灯具',
          imageUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-light.png',
          ],
          requiredSupplierCount: 2,
          supplierQuotes: [
            {
              supplierSourceMode: 'counterparty',
              supplierId: 2,
              supplierCode: 'SUP-BRAVO',
              supplierName: 'Bravo Industrial',
              purchasePrice: 54.1,
            },
          ],
          confirmedSalePrice: 56.2,
        },
      ],
    });
    const { default: AppFormalInquiryDetailPage } = await import(
      '../app/app/sales/inquiries/[id]/page'
    );

    render(
      <>
        {await AppFormalInquiryDetailPage({
          params: Promise.resolve({ id: '3' }),
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(
      screen.queryByRole('button', { name: '提交比价' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '再次提交比价' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '老板确认' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByAltText('室内灯具 图片 1')[0]).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-light.png',
    );
    expect(screen.getAllByAltText('室内灯具 图片 1')).toHaveLength(2);
  });

  it('loads the formal inquiry detail page from the live inquiry detail API', async () => {
    const fetchMock = stubInquiryDetailFetch({
      id: 13,
      inquiryNo: 'IQ202607080013',
      status: 'pending_inquiry',
      quoteOrderId: 12,
      quoteOrderNo: 'Q202607080012',
      quoteVersionNo: 1,
      customerName: '测试客户01',
      customerFullName: '测试客户01（正式）',
      createdBy: 'Admin',
      supplierCount: 2,
      comparisonSummary: '等待采购补录询价单位与采购价格。',
      createdAt: '2026-07-21T08:30:00.000Z',
      detailHref: '/app/sales/inquiries/13',
      items: [
        {
          itemId: 1301,
          lineNo: 1,
          sku: 'SKU-RUNTIME-013',
          productName: 'Runtime Inquiry Product',
          imageUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-runtime.png',
          ],
          requiredSupplierCount: 2,
          supplierQuotes: [
            {
              supplierSourceMode: 'counterparty',
              supplierId: 2,
              supplierCode: 'SUP-BRAVO',
              supplierName: 'Bravo Industrial',
              purchasePrice: 18.6,
            },
            {
              supplierSourceMode: 'manual',
              supplierName: '深圳快联电子',
              purchasePrice: 19.2,
            },
          ],
          confirmedSalePrice: 18.6,
        },
      ],
    });

    const { default: AppFormalInquiryDetailPage } = await import(
      '../app/app/sales/inquiries/[id]/page'
    );

    render(
      <>
        {await AppFormalInquiryDetailPage({
          params: Promise.resolve({ id: '13' }),
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:3001/api/quote-inquiries/13'),
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'admin',
          'x-erp-user': 'Admin',
        }),
      }),
    );
    expect(
      screen.getByRole('heading', { name: '询价单 IQ202607080013' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Q202607080012')).toBeInTheDocument();
    expect(screen.getByText('报价版本：V1')).toBeInTheDocument();
    expect(
      screen.getByLabelText('行 1 供应商 1'),
    ).toHaveValue('SUP-BRAVO / 光源制造 / Bravo Industrial');
    expect(
      screen.getAllByAltText('Runtime Inquiry Product 图片 1')[0],
    ).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/inquiry-runtime.png',
    );
    expect(
      screen.queryByText('询价详情加载失败'),
    ).not.toBeInTheDocument();
  });

  it('hides boss confirmation from purchase managers on the formal inquiry detail page', async () => {
    stubInquiryDetailFetch({
      id: 1,
      inquiryNo: 'IQ202607080001',
      status: 'pending_inquiry',
      quoteOrderId: 1,
      quoteOrderNo: 'Q202607080001',
      quoteVersionNo: 1,
      customerName: 'Acme Trading',
      createdBy: 'Zoe',
      supplierCount: 2,
      comparisonSummary: '已收齐 2 家供应商报价，等待提交比价。',
      createdAt: '2026-07-08T11:20:00.000Z',
      detailHref: '/app/sales/inquiries/1',
      items: [
        {
          itemId: 10,
          lineNo: 1,
          sku: 'SKU-FAN-001',
          productName: '便携风扇',
          requiredSupplierCount: 2,
          supplierQuotes: [
            {
              supplierSourceMode: 'counterparty',
              supplierId: 2,
              supplierCode: 'SUP-BRAVO',
              supplierName: 'Bravo Industrial',
              purchasePrice: 18.6,
            },
            {
              supplierSourceMode: 'manual',
              supplierName: '深圳快联电子',
              purchasePrice: 19.2,
            },
          ],
          confirmedSalePrice: 28.8,
        },
      ],
    });
    const { default: AppFormalInquiryDetailPage } = await import(
      '../app/app/sales/inquiries/[id]/page'
    );

    render(
      <>
        {await AppFormalInquiryDetailPage({
          params: Promise.resolve({ id: '1' }),
          searchParams: Promise.resolve({
            role: 'purchase_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '提交比价' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '打开源报价详情' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText('行 1 供应商 1'),
    ).toHaveValue('SUP-BRAVO / 光源制造 / Bravo Industrial');
    expect(
      screen.queryByRole('button', { name: '老板确认' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        '当前状态动作：待询价可提交比价；待老板确认可确认最终售价；老板已确认后不再展示提交和确认入口。',
      ),
    ).toBeInTheDocument();
  });

  it('allows purchase users to open the formal inquiry list', async () => {
    const { default: AppFormalInquiryPage } = await import(
      '../app/app/sales/inquiries/page'
    );
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
              id: 91,
              inquiryNo: 'IQ-PURCHASE-001',
              status: 'pending_inquiry',
              quoteOrderId: 101,
              quoteOrderNo: 'Q-PURCHASE-001',
              quoteVersionNo: 1,
              customerName: '采购可见客户',
              customerFullName: '采购可见客户有限公司',
              createdBy: 'Zoe',
              supplierCount: 0,
              comparisonSummary: '等待采购补录供应商价格。',
              createdAt: '2026-07-21T08:00:00.000Z',
              detailHref: '/app/sales/inquiries/91',
              items: [],
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
        {await AppFormalInquiryPage({
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式询价单' })).toBeInTheDocument();
    expect(screen.queryByText('无权限访问正式询价单')).not.toBeInTheDocument();
    expect(screen.getByText('IQ-PURCHASE-001')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('http://127.0.0.1:3001/api/quote-inquiries'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-erp-role': 'purchase',
          'x-erp-user': 'Leo',
        }),
      }),
    );
  });

  it('blocks sales users from opening the formal inquiry list', async () => {
    const { default: AppFormalInquiryPage } = await import(
      '../app/app/sales/inquiries/page'
    );
    vi.stubGlobal('fetch', vi.fn());

    render(
      <>
        {await AppFormalInquiryPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByText('无权限访问正式询价单')).toBeInTheDocument();
    expect(screen.queryByText('IQ202607080001')).not.toBeInTheDocument();
  });

  it('blocks sales users from opening formal inquiry details', async () => {
    stubInquiryDetailFetch({
      id: 15,
      inquiryNo: 'IQ202607080015',
      status: 'pending_inquiry',
      quoteOrderId: 15,
      quoteOrderNo: 'Q202607080015',
      quoteVersionNo: 1,
      customerName: '销售不可见客户',
      createdBy: 'Zoe',
      supplierCount: 1,
      comparisonSummary: '销售不应直接查看询价详情。',
      createdAt: '2026-07-21T08:00:00.000Z',
      detailHref: '/app/sales/inquiries/15',
      items: [],
    });
    const { default: AppFormalInquiryDetailPage } = await import(
      '../app/app/sales/inquiries/[id]/page'
    );

    render(
      <>
        {await AppFormalInquiryDetailPage({
          params: Promise.resolve({ id: '15' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByText('无权限访问正式询价单')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '询价单 IQ202607080015' }),
    ).not.toBeInTheDocument();
  });

  it('allows purchase users to submit supplier comparison on inquiry details', async () => {
    stubInquiryDetailFetch({
      id: 14,
      inquiryNo: 'IQ202607080014',
      status: 'pending_inquiry',
      quoteOrderId: 14,
      quoteOrderNo: 'Q202607080014',
      quoteVersionNo: 1,
      customerName: '采购询价客户',
      createdBy: 'Zoe',
      supplierCount: 2,
      comparisonSummary: '等待采购补录询价单位与采购价格。',
      createdAt: '2026-07-21T08:00:00.000Z',
      detailHref: '/app/sales/inquiries/14',
      items: [
        {
          itemId: 14,
          lineNo: 1,
          sku: 'SKU-PUR-014',
          productName: '采购询价商品',
          requiredSupplierCount: 2,
          supplierQuotes: [
            {
              supplierSourceMode: 'counterparty',
              supplierId: 2,
              supplierCode: 'SUP-BRAVO',
              supplierName: 'Bravo Industrial',
              purchasePrice: 18.6,
            },
          ],
          confirmedSalePrice: 0,
        },
      ],
    });
    const { default: AppFormalInquiryDetailPage } = await import(
      '../app/app/sales/inquiries/[id]/page'
    );

    render(
      <>
        {await AppFormalInquiryDetailPage({
          params: Promise.resolve({ id: '14' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式询价详情' })).toBeInTheDocument();
    expect(screen.queryByText('无权限访问正式询价单')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交比价' })).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: '老板确认售价' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '老板确认' }),
    ).not.toBeInTheDocument();
  });

});
