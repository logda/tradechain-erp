import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('formal detail pages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the formal quote detail page inside the formal shell', async () => {
    const quoteDetail = {
      id: 101,
      quoteNo: 'Q202607080101',
      documentType: 'quote',
      status: 'draft',
      currentVersionNo: 1,
      customerId: 1001,
      customerName: 'Acme Trading',
      customerCode: 'CUST-ACME',
      customerEntryMode: 'existing',
      salesUserId: 2001,
      sourceCode: 'expo',
      inquiryDate: '2026-07-18',
      destination: 'Berlin',
      requirements: 'Need 500 units',
      quoteAttachments: [
        {
          key: 'formal-quote-attachments/2026/07/21/quote-spec.pdf',
          fileName: 'quote-spec.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/2026/07/21/quote-spec.pdf',
        },
      ],
      items: [
        {
          lineNo: 1,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          salePrice: 15.9,
          amount: 7950,
          imageUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led-2.png',
          ],
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/quotes/audit-logs')) {
          return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
        }

        if (url.includes('/samples/source-quotes/101/summary')) {
          return Promise.resolve({ ok: false, json: async () => null });
        }

        if (url.includes('/formal-lookup/counterparties?type=customer&status=active')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 1001,
                  type: 'customer',
                  code: 'CUST-ACME',
                  name: '上海星河贸易有限公司',
                  shortName: '星河贸易',
                  status: 'active',
                },
              ],
            }),
          });
        }

        if (url.includes('/formal-lookup/products?status=active')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 1,
                  sku: 'SKU-LED-001',
                  nameCn: '智能 LED 灯带',
                  nameEn: 'Smart LED Strip',
                  unit: 'set',
                  defaultSalePrice: 15.9,
                  status: 'active',
                },
              ],
            }),
          });
        }

        if (url.includes('/quotes/create-metadata')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              salesUsers: [
                {
                  id: 2001,
                  username: 'Zoe',
                  realName: 'Zoe',
                  roleCode: 'sales',
                  status: 'active',
                },
                {
                  id: 2000,
                  username: 'Mia',
                  realName: 'Mia',
                  roleCode: 'sales_manager',
                  status: 'active',
                },
              ],
            }),
          });
        }

        if (url.includes('/quote-sources')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                { code: 'expo', label: '展会', enabled: true, sortOrder: 1 },
                { code: 'online', label: '线上', enabled: true, sortOrder: 2 },
              ],
            }),
          });
        }

        return Promise.resolve({ ok: true, json: async () => quoteDetail });
      }),
    );

    const { default: AppQuoteDetailPage } = await import(
      '../app/app/sales/quotes/[id]/page'
    );

    const { container } = render(
      <>
        {await AppQuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
            fromInquiryId: '2',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式需求和报价详情' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式需求和报价列表' }),
    ).toHaveAttribute('href', '/app/sales/quotes');
    expect(
      screen.getByRole('link', { name: '返回正式首页' }),
    ).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('link', { name: '返回询价单详情' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '报价单 Q202607080101' }),
    ).toBeInTheDocument();
    const quoteDetailFetchCall = vi.mocked(fetch).mock.calls.find(([input]) =>
      String(input).includes('/quotes/101'),
    );
    expect(quoteDetailFetchCall?.[1]?.headers).toMatchObject({
      'x-erp-role': 'sales_manager',
      'x-erp-user': 'Mia',
      'x-erp-session': expect.any(String),
      'x-erp-session-signature': expect.any(String),
    });
    expect(screen.getByText('draft / 草稿')).toBeInTheDocument();
    expect(screen.getAllByText('报价附件 Quote Attachments')).toHaveLength(2);
    expect(screen.getAllByText('quote-spec.pdf')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: '报价明细' })).toBeInTheDocument();
    expect(screen.getByText('星河贸易 / Acme Trading')).toBeInTheDocument();
    expect(screen.getByText('SKU-LED-001')).toBeInTheDocument();
    expect(screen.getByText('智能 LED 灯带')).toBeInTheDocument();
    expect(screen.getByAltText('智能 LED 灯带 图片 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
    );
    fireEvent.click(
      screen.getByRole('button', { name: '查看 智能 LED 灯带 图片 1' }),
    );
    expect(
      screen.getByRole('dialog', { name: '智能 LED 灯带 图片预览' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: '智能 LED 灯带 图片预览' }).firstElementChild,
    ).toHaveClass('erp-dialog');
    expect(screen.getByAltText('智能 LED 灯带 大图预览 1')).toHaveClass(
      'erp-media-contain',
    );
    expect(screen.getByAltText('智能 LED 灯带 大图预览 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
    );
    expect(
      screen.getByRole('button', { name: '上一张' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '下一张' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '下一张' }));
    expect(screen.getByAltText('智能 LED 灯带 大图预览 2')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led-2.png',
    );
    fireEvent.click(screen.getByRole('button', { name: '上一张' }));
    expect(screen.getByAltText('智能 LED 灯带 大图预览 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
    );
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(
      screen.queryByRole('dialog', { name: '智能 LED 灯带 图片预览' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('7950')).toBeInTheDocument();
    expect(screen.getByLabelText('询单日期 Inquiry Date')).toHaveValue('2026-07-18');
    expect(screen.getByLabelText('目的地 Destination')).toHaveValue('Berlin');
    expect(screen.getByLabelText('客户编码 Customer Code')).toHaveValue('CUST-ACME');
    expect(screen.getByLabelText('客户名称 Customer Name')).toHaveValue('星河贸易 / Acme Trading');
    expect(screen.getByText('商品 Product')).toBeInTheDocument();
    expect(screen.getByLabelText('数量 Quantity')).toHaveValue(500);
    expect(screen.getByLabelText('销售单价 Sale Price')).toHaveValue(15.9);
    expect(screen.getByLabelText('需求说明 Requirements')).toHaveValue('Need 500 units');
    expect(screen.getByRole('button', { name: '保存报价草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交报价单' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '转为销售订单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '创建样品单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('当前为报价单草稿：提交后等待老板确认最终售价，不生成首次采购询价。'),
    ).toBeInTheDocument();

    expect(
      container.querySelector<HTMLInputElement>('input[name="currentStatus"]')?.value,
    ).toBeUndefined();
    expect(
      container.querySelector<HTMLInputElement>('input[name="quoteOrderId"]')?.value,
    ).toBeUndefined();
    expect(
      container.querySelector<HTMLInputElement>('input[name="quoteVersionNo"]')?.value,
    ).toBeUndefined();
    expect(
      container.querySelector<HTMLInputElement>('input[name="sampleRequirements"]')?.value,
    ).toBeUndefined();
  });

  it('hides quote detail conversion actions before boss confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          quoteNo: 'Q202607080101',
          documentType: 'quote',
          productSource: 'existing',
          status: 'pending_boss_price_confirmation',
          currentVersionNo: 1,
          customerId: 1001,
          salesUserId: 2001,
          sourceCode: 'expo',
          requirements: 'Need 500 units',
          items: [
            {
              lineNo: 1,
              productId: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              salePrice: 15.9,
              amount: 7950,
            },
          ],
        }),
      }),
    );

    const { default: AppQuoteDetailPage } = await import(
      '../app/app/sales/quotes/[id]/page'
    );

    render(
      <>
        {await AppQuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['sales'],
                dataScope: 'sales_team',
                actions: ['sales.quote.write', 'sales.sample.submit'],
              }),
            ),
          }),
        })}
      </>,
    );

    expect(
      screen.queryByRole('button', { name: '转为销售订单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '创建样品单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('报价单尚未满足转销售单条件：必须先由老板确认售价，再由销售记录客户接受。'),
    ).toBeInTheDocument();
  });

  it('shows boss-confirmed prices and the sales customer-feedback area', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes('/quotes/audit-logs')) {
          return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
        }

        if (url.includes('/samples/source-quotes/103/summary')) {
          return Promise.resolve({ ok: false, json: async () => null });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 103,
            quoteNo: 'Q202607080103',
            documentType: 'quote',
            productSource: 'existing',
            status: 'pending_customer_feedback',
            currentVersionNo: 1,
            customerId: 1001,
            customerName: 'Acme Trading',
            salesUserId: 2001,
            sourceCode: 'expo',
            requirements: 'Need 500 units',
            versionHistory: [
              {
                versionNo: 1,
                status: 'pending_customer_feedback',
                confirmedAt: '2026-07-08T12:00:00.000Z',
                confirmedBy: 'Mia',
                items: [],
              },
            ],
            items: [
              {
                lineNo: 1,
                productId: 1,
                sku: 'SKU-LED-001',
                productName: '智能 LED 灯带',
                unit: 'set',
                quantity: 500,
                salePrice: 15.9,
                confirmedSalePrice: 18.8,
                amount: 7950,
              },
            ],
          }),
        });
      }),
    );

    const { default: AppQuoteDetailPage } = await import(
      '../app/app/sales/quotes/[id]/page'
    );

    render(
      <>
        {await AppQuoteDetailPage({
          params: Promise.resolve({ id: '103' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '报价结果' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '老板确认售价' })).toBeInTheDocument();
    expect(screen.getByText('18.8')).toBeInTheDocument();
    expect(screen.queryByText('最终供应商')).not.toBeInTheDocument();
    expect(screen.queryByText('采购价')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '老板确认报价售价' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '销售记录客户反馈' })).toBeInTheDocument();
    expect(screen.getAllByText('V1').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '保存客户反馈' })).toBeInTheDocument();
  });

  it('shows conversion action for boss-approved demand documents', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 102,
          quoteNo: 'XQ202607080102',
          documentType: 'demand',
          productSource: 'existing',
          status: 'boss_approved',
          currentVersionNo: 1,
          customerId: 1001,
          customerName: 'Acme Trading',
          salesUserId: 2001,
          sourceCode: 'expo',
          requirements: 'Need product-library item',
          items: [
            {
              lineNo: 1,
              productId: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              salePrice: 15.9,
              amount: 7950,
            },
          ],
        }),
      }),
    );

    const { default: AppQuoteDetailPage } = await import(
      '../app/app/sales/quotes/[id]/page'
    );

    render(
      <>
        {await AppQuoteDetailPage({
          params: Promise.resolve({ id: '102' }),
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['sales'],
                dataScope: 'sales_team',
                actions: ['sales.order.write'],
              }),
            ),
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '转为销售订单' })).toBeInTheDocument();
    expect(
      screen.getByText('需求单已通过老板审批，可以转为销售单。'),
    ).toBeInTheDocument();
  });

  it('separates quote detail action buttons by sales order and sample action permissions after boss confirmation', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/samples/source-quotes/101/summary')) {
        return {
          ok: true,
          json: async () => ({
            quoteOrderId: 101,
            totalSampleCount: 2,
            activeSampleCount: 1,
            latestSampleNo: 'SP202607110102',
          }),
        };
      }

      if (url.includes('/quotes/audit-logs')) {
        return {
          ok: true,
          json: async () => ({ items: [] }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          id: 101,
          quoteNo: 'Q202607080101',
          status: 'boss_confirmed',
          currentVersionNo: 1,
          customerId: 1001,
          salesUserId: 2001,
          sourceCode: 'expo',
          requirements: 'Need 500 units',
          items: [
            {
              lineNo: 1,
              productId: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              salePrice: 15.9,
              amount: 7950,
            },
          ],
        }),
      };
    });
    vi.stubGlobal(
      'fetch',
      fetchMock,
    );

    const { default: AppQuoteDetailPage } = await import(
      '../app/app/sales/quotes/[id]/page'
    );

    render(
      <>
        {await AppQuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['sales'],
                dataScope: 'sales_team',
                actions: ['sales.quote.write', 'sales.sample.submit'],
              }),
            ),
          }),
        })}
      </>,
    );

    expect(
      screen.queryByRole('button', { name: '转为销售订单' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建样品单' })).toBeInTheDocument();
    expect(
      screen.queryByText(/该报价单已存在 2 张样品单，其中 1 张未取消/),
    ).not.toBeInTheDocument();
  });

  it('blocks sales users from opening another user\'s formal quote detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          quoteNo: 'Q202607080101',
          status: 'purchasing',
          currentVersionNo: 1,
          customerId: 1001,
          salesUserId: 2001,
          sourceCode: 'expo',
          requirements: 'Need 500 units',
          items: [],
        }),
      }),
    );

    const { default: AppQuoteDetailPage } = await import(
      '../app/app/sales/quotes/[id]/page'
    );

    render(
      <>
        {await AppQuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByText('无权限访问正式报价单')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '报价单 Q202607080101' }),
    ).not.toBeInTheDocument();
  });

  it('blocks purchase users from opening formal quote detail before loading data', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppQuoteDetailPage } = await import(
      '../app/app/sales/quotes/[id]/page'
    );

    render(
      <>
        {await AppQuoteDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByText('无权限访问正式报价单')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders the formal sales order detail page inside the formal shell', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          title: 'Acme 秋季促销补货',
          status: 'purchasing',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'arrived',
          sourceQuoteOrderId: 88,
          sourceQuoteVersionNo: 4,
          sourceQuoteNo: 'Q202607080088',
          sourceDocumentType: 'quote',
          receiptSendStatus: 'sent',
          afterSalesEndStatus: 'closed',
          receiptStatus: 'fully_paid',
          financeStatus: 'confirmed',
          customerName: 'Acme Trading',
          customerOrderNo: '1234-1',
          orderingUnit: 'Acme Trading',
          storeName: '02 Libuys',
          orderDate: '2026-05-30',
          estimatedDeliveryDate: '2026-06-08',
          shipTo: 'SH Boninoe',
          salesOrderRemark: '单个销售单可能会有多个工厂的产品',
          salesOrderAttachments: [
            {
              key: 'sales-order-attachments/2026/07/24/sales-image.png',
              fileName: 'sales-image.png',
              mimeType: 'image/png',
              size: 11,
              url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/sales-image.png',
            },
            {
              key: 'sales-order-attachments/2026/07/24/sales-spec.pdf',
              fileName: 'sales-spec.pdf',
              mimeType: 'application/pdf',
              size: 10,
              url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/sales-spec.pdf',
            },
          ],
          cancelReason: '客户取消订单',
          createdBy: 2001,
          salesUserId: 2001,
          autoVoidedPurchaseOrderIds: [3001, 3002],
          linkedPurchaseOrders: [
            {
              id: 301,
              purchaseNo: 'P202607110301',
              status: 'purchasing',
            },
            {
              id: 302,
              purchaseNo: 'P202607110302',
              status: 'void',
            },
          ],
          items: [
            {
              lineNo: 1,
              sourceQuoteLineNo: 2,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              quantity: 500,
              packageQuantity: 20,
              unitsPerPackage: 200,
              totalQuantity: 4000,
              cartonQuantity: 24,
              outerCartonSizeCm: '50×40×30',
              outerCartonGrossWeightKg: 12.5,
              unit: 'set',
              salePrice: 15.9,
              amount: 7950,
              factoryPicUrls: [
                'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
                'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led-side.png',
              ],
            },
          ],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式销售单详情' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式销售单列表' }),
    ).toHaveAttribute('href', '/app/sales/orders');
    expect(
      screen.getByRole('link', { name: '返回正式首页' }),
    ).toHaveAttribute('href', '/app');
    expect(
      screen.getByRole('link', { name: '返回销售中心' }),
    ).toHaveAttribute('href', '/app/sales');
    expect(
      screen.getByRole('heading', { name: '销售订单 S202607080001' }),
    ).toBeInTheDocument();
    expect(screen.getByText('订单标题：Acme 秋季促销补货')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '重提审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '打开采购转单页' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成采购单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '作废销售单' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '来源追溯' })).toBeInTheDocument();
    expect(screen.getByText('来源报价：Q202607080088 / V4')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看来源报价 Q202607080088' }),
    ).toHaveAttribute('href', '/app/sales/quotes/88');
    expect(screen.getByText('来源类型：报价单')).toBeInTheDocument();
    expect(screen.getByText('来源报价版本：V4')).toBeInTheDocument();
    expect(
      screen.getByText('来源报价信息会保留在系统追溯字段中，销售明细仅展示业务识别字段。'),
    ).toBeInTheDocument();
    expect(screen.queryByText('来源行 Source Line')).not.toBeInTheDocument();
    const salesItemsHeading = screen.getByRole('heading', { name: '销售明细' });
    const orderFieldsHeading = screen.getByRole('heading', { name: '订单字段' });
    expect(salesItemsHeading).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '装箱数' })).toBeInTheDocument();
    expect(screen.getByText('50×40×30')).toBeInTheDocument();
    expect(screen.getByText('12.5')).toBeInTheDocument();
    expect(orderFieldsHeading).toBeInTheDocument();
    expect(
      salesItemsHeading.compareDocumentPosition(orderFieldsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('Acme 秋季促销补货')).toBeInTheDocument();
    expect(screen.getByText('1234-1')).toBeInTheDocument();
    expect(screen.getByText('星河贸易 / Acme Trading')).toBeInTheDocument();
    expect(screen.getByText('02 Libuys')).toBeInTheDocument();
    expect(screen.getByText('2026-05-30')).toBeInTheDocument();
    expect(screen.getByText('截止日期 Deadline')).toBeInTheDocument();
    expect(screen.getByText('2026-06-08')).toBeInTheDocument();
    expect(screen.getByText('SH Boninoe')).toBeInTheDocument();
    expect(screen.getByText('单个销售单可能会有多个工厂的产品')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'sales-image.png' })).toHaveAttribute(
      'href',
      'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/sales-image.png',
    );
    expect(screen.getByRole('link', { name: 'sales-image.png' }).querySelector('img')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/sales-image.png',
    );
    expect(screen.getByRole('link', { name: 'sales-spec.pdf' })).toHaveAttribute(
      'href',
      'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/sales-spec.pdf',
    );
    expect(
      screen.getByRole('heading', { name: '销售收口检查' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('draft / 草稿')).not.toBeInTheDocument();
    expect(screen.getAllByText('purchasing / 采购中').length).toBeGreaterThan(0);
    expect(screen.getByText('arrived / 已到货')).toBeInTheDocument();
    expect(screen.getAllByText('sent / 已发送').length).toBeGreaterThan(0);
    expect(screen.getAllByText('fully_paid / 已全款').length).toBeGreaterThan(0);
    expect(screen.getAllByText('confirmed / 已确认').length).toBeGreaterThan(0);
    expect(screen.queryByText('回单状态：sent / 已发送')).not.toBeInTheDocument();
    expect(screen.queryByText('售后闭环：closed / 已闭环')).not.toBeInTheDocument();
    expect(screen.queryByText('售后闭环 After-sales')).not.toBeInTheDocument();
    expect(screen.queryByText('收款状态：fully_paid / 已全款')).not.toBeInTheDocument();
    expect(screen.queryByText('财务确认：confirmed / 已确认')).not.toBeInTheDocument();
    expect(screen.getByText('售后阶段：closed / 已闭环')).toBeInTheDocument();
    expect(screen.getByText('交货代/履约收口：通过')).toBeInTheDocument();
    expect(screen.getByText('回单发送（跟踪）：通过')).toBeInTheDocument();
    expect(screen.getByText('售后状态（跟踪）：通过')).toBeInTheDocument();
    expect(screen.getByText('财务确认（保留）：通过')).toBeInTheDocument();
    expect(screen.getByText('收款状态（保留）：通过')).toBeInTheDocument();
    expect(screen.getByText('客户取消订单')).toBeInTheDocument();
    expect(screen.getByText('3001, 3002')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '关联采购单' })).toBeInTheDocument();
    expect(screen.getByText('P202607110301')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看采购单' }),
    ).toHaveAttribute('href', '/app/purchase-orders/301');
    expect(screen.queryByText('P202607110302')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '更新收款状态' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '财务确认' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '销售收口' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '销售明细' })).toBeInTheDocument();
    expect(screen.getByText('SKU-LED-001')).toBeInTheDocument();
    expect(screen.getByText('智能 LED 灯带')).toBeInTheDocument();
    expect(screen.getByText('4000')).toBeInTheDocument();
    expect(screen.getByAltText('智能 LED 灯带 图片 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
    );
    expect(screen.getByAltText('智能 LED 灯带 图片 2')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led-side.png',
    );
    fireEvent.click(
      screen.getByRole('button', { name: '查看 智能 LED 灯带 图片 1' }),
    );
    expect(
      screen.getByRole('dialog', { name: '智能 LED 灯带 图片预览' }),
    ).toBeInTheDocument();
    expect(screen.getByAltText('智能 LED 灯带 大图预览 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
    );
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(
      screen.queryByRole('dialog', { name: '智能 LED 灯带 图片预览' }),
    ).not.toBeInTheDocument();
  });

  it('renders demand source wording for sales orders converted from demand documents', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 121,
          salesNo: 'S202607110121',
          title: '需求单 XQ202607080088 转销售单',
          status: 'draft',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'not_started',
          shipmentAggregateStatus: 'not_started',
          sourceQuoteOrderId: 88,
          sourceQuoteVersionNo: 1,
          sourceQuoteNo: 'XQ202607080088',
          sourceDocumentType: 'demand',
          receiptSendStatus: 'pending',
          afterSalesEndStatus: 'not_started',
          receiptStatus: 'unpaid',
          financeStatus: 'pending',
          customerName: 'Acme Trading',
          customerOrderNo: 'PO-202607110121',
          orderingUnit: 'Acme Trading',
          createdBy: 2001,
          salesUserId: 2001,
          items: [],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '121' }),
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '来源追溯' })).toBeInTheDocument();
    expect(screen.getByText('来源需求：XQ202607080088 / V1')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看来源需求 XQ202607080088' }),
    ).toHaveAttribute('href', '/app/sales/quotes/88');
    expect(screen.getByText('来源类型：需求单')).toBeInTheDocument();
    expect(screen.getByText('来源需求版本：V1')).toBeInTheDocument();
    expect(
      screen.getByText('来源需求信息会保留在系统追溯字段中，销售明细仅展示业务识别字段。'),
    ).toBeInTheDocument();
    expect(screen.queryByText('报价来源版本：V-')).not.toBeInTheDocument();
  });

  it('shows linked purchase numbers without purchase detail links for sales users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'purchasing',
          title: 'Acme 秋季促销补货',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'purchasing',
          receiptSendStatus: 'pending',
          afterSalesEndStatus: 'not_started',
          receiptStatus: 'unpaid',
          financeStatus: 'pending',
          createdBy: 2001,
          salesUserId: 2001,
          linkedPurchaseOrders: [
            {
              id: 301,
              purchaseNo: 'P202607110301',
              status: 'draft',
            },
          ],
          items: [],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '关联采购单' })).toBeInTheDocument();
    expect(screen.getByText('P202607110301')).toBeInTheDocument();
    expect(screen.getByText('draft / 草稿')).toBeInTheDocument();
    expect(screen.queryByText('操作 Action')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '查看采购单' }),
    ).not.toBeInTheDocument();
  });

  it('blocks sales users from opening another user\'s formal sales order detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'draft',
          title: 'Acme 草稿补资料',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'arrived',
          sourceQuoteOrderId: 88,
          sourceQuoteVersionNo: 4,
          receiptSendStatus: 'sent',
          afterSalesEndStatus: 'closed',
          receiptStatus: 'fully_paid',
          financeStatus: 'confirmed',
          createdBy: 2001,
          salesUserId: 2001,
          items: [],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(
      screen.getByText('无权限访问正式销售单'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '销售订单 S202607080001' }),
    ).not.toBeInTheDocument();
  });

  it('blocks purchase users from opening formal sales order detail before loading data', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByText('无权限访问正式销售单')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows only draft submission action from sales users on draft sales order detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'draft',
          title: 'Acme 草稿补资料',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'arrived',
          receiptSendStatus: 'sent',
          afterSalesEndStatus: 'closed',
          receiptStatus: 'fully_paid',
          financeStatus: 'confirmed',
          createdBy: 2001,
          salesUserId: 2001,
          items: [],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.queryByRole('link', { name: '继续编辑草稿' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交审批' })).toBeInTheDocument();
    expect(screen.getByLabelText('订单标题 Title')).toHaveValue('Acme 草稿补资料');
    expect(screen.getByText('当前仅显示当前角色和当前销售单状态下可执行的动作。')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '重提审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '作废销售单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '销售收口' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成采购单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '更新收款状态' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '财务确认' }),
    ).not.toBeInTheDocument();
  });

  it('hides purchasing-stage sales order actions from sales users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'purchasing',
          title: 'Acme 采购中订单',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'purchasing',
          receiptSendStatus: 'pending',
          afterSalesEndStatus: 'not_started',
          receiptStatus: 'unpaid',
          financeStatus: 'pending',
          createdBy: 2001,
          salesUserId: 2001,
          items: [],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByText('当前仅显示当前角色和当前销售单状态下可执行的动作。')).toBeInTheDocument();
    expect(screen.getAllByText('purchasing / 采购中').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '保存草稿' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交审批' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重提审批' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '作废销售单' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更新收款状态' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '财务确认' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '销售收口' })).not.toBeInTheDocument();
  });

  it('hides purchasing-stage sales order actions from boss users before downstream closure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'purchasing',
          title: 'Acme 采购中订单',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'purchasing',
          receiptSendStatus: 'pending',
          afterSalesEndStatus: 'not_started',
          receiptStatus: 'unpaid',
          financeStatus: 'pending',
          createdBy: 2001,
          salesUserId: 2001,
          items: [],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getAllByText('purchasing / 采购中').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: '重提审批' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '作废销售单' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更新收款状态' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '财务确认' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '销售收口' })).not.toBeInTheDocument();
  });

  it('shows draft editing actions on rejected sales order detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'rejected',
          title: 'Acme 驳回后修改',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'not_started',
          shipmentAggregateStatus: 'not_started',
          receiptSendStatus: 'pending',
          afterSalesEndStatus: 'not_started',
          receiptStatus: 'unpaid',
          financeStatus: 'pending',
          createdBy: 2001,
          salesUserId: 2001,
          items: [],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getAllByText('rejected / 已驳回').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交审批' })).toBeInTheDocument();
    expect(screen.getByLabelText('订单标题 Title')).toHaveValue('Acme 驳回后修改');
  });

  it('renders the formal sales order draft edit page with existing draft values', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/sales-orders/101')) {
        return {
          ok: true,
          json: async () => ({
            id: 101,
            salesNo: 'S202607080001',
            status: 'draft',
            currentVersionNo: 1,
            purchaseAggregateStatus: 'not_started',
            shipmentAggregateStatus: 'not_started',
            customerId: 1,
            customerEntryMode: 'existing',
            customerName: 'Acme Trading',
            customerCode: 'CUST-ACME',
            customerOrderNo: 'PO-DRAFT-1',
            storeName: '02 Libuys',
            orderDate: '2026-05-30',
            estimatedDeliveryDate: '2026-06-08',
            shipTo: 'SH Boninoe',
            title: 'Acme 草稿继续保存',
            salesUserId: 2001,
            createdBy: 2001,
            salesOrderRemark: '草稿继续补资料',
            salesOrderAttachments: [
              {
                key: 'sales-order-attachments/2026/07/24/old.png',
                fileName: 'old.png',
                mimeType: 'image/png',
                size: 8,
                url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/old.png',
              },
            ],
            items: [
              {
                lineNo: 1,
                productId: 1,
                sku: 'SKU-LED-001',
                productName: '智能 LED 灯带',
                factoryPicUrls: [
                  'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/factory-old.png',
                ],
                packageQuantity: 2,
                unitsPerPackage: 100,
                totalQuantity: 200,
                quantity: 200,
                unit: 'set',
                salePrice: 15.9,
              },
            ],
          }),
        };
      }

      if (url.includes('/formal-lookup/counterparties?type=customer&status=active')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                type: 'customer',
                code: 'CUST-ACME',
                name: 'Acme Trading',
                shortName: '星河贸易',
                status: 'active',
              },
            ],
          }),
        };
      }

      if (url.includes('/formal-lookup/products?status=active')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                sku: 'SKU-LED-001',
                nameCn: '智能 LED 灯带',
                nameEn: 'Smart LED Strip',
                unit: 'set',
                defaultSalePrice: 15.9,
                status: 'active',
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          salesUsers: [
            {
              id: 2001,
              username: 'zoe',
              realName: 'Zoe',
              roleCode: 'sales',
              status: 'active',
            },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppEditSalesOrderDraftPage } = await import(
      '../app/app/sales/orders/[id]/edit/page'
    );

    render(
      <>
        {await AppEditSalesOrderDraftPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '编辑销售单草稿' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '编辑草稿 S202607080001' })).toBeInTheDocument();
    expect(screen.getByLabelText('订货单位 Ordering')).toHaveValue(
      'CUST-ACME / Acme Trading / 星河贸易',
    );
    expect(screen.getByLabelText('客户订单号 Customer PO No')).toHaveValue('PO-DRAFT-1');
    expect(screen.getByLabelText('门店 Store')).toHaveValue('02 Libuys');
    expect(screen.getByLabelText('订单标题 Title')).toHaveValue('Acme 草稿继续保存');
    expect(screen.getByLabelText('货品编码 Product No')).toHaveValue('SKU-LED-001');
    expect(screen.getByLabelText('货品名称 Product Name')).toHaveValue('智能 LED 灯带');
    expect(screen.getByText('已保留 1 张图片，可继续追加上传。')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '已保存销售单附件' })).toBeInTheDocument();
    expect(screen.getByText('old.png')).toBeInTheDocument();
    const attachmentInput = screen.getByLabelText('销售单附件 Attachments');
    fireEvent.change(attachmentInput, {
      target: {
        files: [new File(['new attachment'], 'new-sales-order.pdf', { type: 'application/pdf' })],
      },
    });
    expect(
      screen.getByText('已选择 1 个附件，点击保存草稿或提交审批后上传。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交审批' })).toBeInTheDocument();
  });

  it('shows only approval actions on pending sales order detail for sales managers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'pending_sales_manager_approval',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'not_started',
          shipmentAggregateStatus: 'not_started',
          receiptSendStatus: 'pending',
          afterSalesEndStatus: 'not_started',
          receiptStatus: 'unpaid',
          financeStatus: 'pending',
          createdBy: 2001,
          salesUserId: 2001,
          items: [],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '审批通过' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '驳回待修改' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '提交审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成采购单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '重提审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '作废销售单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '财务确认' }),
    ).not.toBeInTheDocument();
  });

  it('allows admin users with module-only access params to approve pending sales orders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'pending_sales_manager_approval',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'not_started',
          shipmentAggregateStatus: 'not_started',
          receiptSendStatus: 'pending',
          afterSalesEndStatus: 'not_started',
          receiptStatus: 'unpaid',
          financeStatus: 'pending',
          createdBy: 2001,
          salesUserId: 2001,
          items: [],
        }),
      }),
    );

    const { default: AppSalesOrderDetailPage } = await import(
      '../app/app/sales/orders/[id]/page'
    );

    render(
      <>
        {await AppSalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
                dataScope: 'all',
              }),
            ),
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '审批通过' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '驳回待修改' })).toBeInTheDocument();
  });

  it('renders the formal sample order detail page inside the formal shell', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          sampleNo: 'SP202607080101',
          currentVersionNo: 2,
          currentStatus: 'pending_sampling',
          sourceQuoteOrderId: 66,
          sourceQuoteVersionNo: 3,
          createdAt: '2026-07-08T09:00:00.000Z',
          sampleRequirements: 'Need blue shell sample',
          samplingCost: 18.5,
          importantEnglishTitle: 'Blue Shell Sample',
          orderCode: 'SO-SAMPLE-101',
          purchaseUnit: '深圳星河工厂',
          salesProductCode: 'SALE-BLUE-101',
          internalProductCode: 'SUP001-101',
          imageUrls: [
            'http://127.0.0.1:3001/uploads/samples/blue-shell.png',
          ],
          sampleQuantity: 8,
          estimatedCompletionDate: '2026-07-28',
          freightForwarder: 'DHL',
          domesticTrackingNo: 'SF123456789CN',
          domesticCourierFee: 35,
          internationalCourierFee: 120,
          estimatedArrivalDate: '2026-08-03',
        }),
      }),
    );

    const { default: AppSampleOrderDetailPage } = await import(
      '../app/app/sales/samples/[id]/page'
    );

    render(
      <>
        {await AppSampleOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式样品单详情' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式样品单列表' }),
    ).toHaveAttribute('href', '/app/sales/samples');
    expect(
      screen.getByRole('link', { name: '返回正式首页' }),
    ).toHaveAttribute('href', '/app');
    expect(
      screen.getByRole('heading', { name: '样品单 SP202607080101' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('pending_sampling / 待打样')).not.toHaveLength(0);
    expect(screen.getByText('下一步：采购开始打样')).toBeInTheDocument();
    expect(screen.getByText('下单日期：2026-07-08')).toBeInTheDocument();
    expect(screen.getByText('报价单 ID：66')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看来源报价 66' }),
    ).toHaveAttribute('href', '/app/sales/quotes/66');
    expect(screen.getByText('报价版本：V3')).toBeInTheDocument();
    expect(screen.getByText('Need blue shell sample')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '客户确认信息' })).toBeInTheDocument();
    expect(screen.getByText('商品名称')).toBeInTheDocument();
    expect(screen.queryByText('重要英文标题')).not.toBeInTheDocument();
    expect(screen.getByText('Blue Shell Sample')).toBeInTheDocument();
    expect(screen.getByText('SALE-BLUE-101')).toBeInTheDocument();
    expect(screen.queryByText('国际快递费用：120')).not.toBeInTheDocument();
    expect(screen.queryByText('预计到达日期：2026-08-03')).not.toBeInTheDocument();
    expect(screen.getByAltText('样品单 SP202607080101 图片 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/samples/blue-shell.png',
    );
    expect(screen.queryByText('SF123456789CN')).not.toBeInTheDocument();
    expect(screen.queryByText('国内快递费用：35')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '销售可见字段' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '采购执行字段' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '提交样品审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '通过样品审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '驳回样品审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '开始打样' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '标记已寄样' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '客户确认样品' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '创建替代版本' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '取消样品单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        '当前可操作动作会根据样品单状态自动切换：提交审批、审批、开始打样、标记寄样和客户反馈。',
      ),
    ).toBeInTheDocument();
  });

  it('keeps draft sample editing with purchase users before submission', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/formal-lookup/counterparties?type=supplier&status=active')) {
          return {
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 11,
                  type: 'supplier',
                  code: 'SUP-BLUE',
                  name: '深圳星河工厂',
                  shortName: '星河',
                  status: 'active',
                },
              ],
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 201,
            sampleNo: 'SP202607080201',
            currentVersionNo: 1,
            currentStatus: 'draft',
            sourceQuoteOrderId: 66,
            sourceQuoteVersionNo: 3,
            sampleRequirements: 'Need draft sample',
            samplingCost: 0,
            orderCode: 'SO-SAMPLE-101',
            purchaseUnit: '',
            salesProductCode: '',
            internalProductCode: '',
            sampleQuantity: 0,
            estimatedCompletionDate: '',
            freightForwarder: '',
            domesticTrackingNo: '',
            domesticCourierFee: 0,
            internationalCourierFee: 0,
            estimatedArrivalDate: '',
          }),
        };
      }),
    );

    const { default: AppSampleOrderDetailPage } = await import(
      '../app/app/sales/samples/[id]/page'
    );

    render(
      <>
        {await AppSampleOrderDetailPage({
          params: Promise.resolve({ id: '201' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getAllByText('draft / 草稿')).not.toHaveLength(0);
    expect(
      screen.getByText('下一步：采购先补充打样信息并保存，再提交样品审批'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交样品审批' })).toBeInTheDocument();
    expect(screen.getByText('产品编码：0')).toBeInTheDocument();
    expect(screen.getByText('订单编码：SO-SAMPLE-101')).toBeInTheDocument();
    expect(screen.queryByLabelText('订单编码')).not.toBeInTheDocument();
    expect(screen.getByLabelText('样品要求')).toBeInTheDocument();
    expect(screen.getByLabelText('打样费')).toBeInTheDocument();
    expect(screen.getByLabelText('样品数量')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '采购单位录入方式' })).toBeInTheDocument();
    expect(screen.getByLabelText('采购单位')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: '选择采购单位' }));
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    expect(screen.getByLabelText('采购单位')).toHaveValue(
      'SUP-BLUE / 深圳星河工厂 / 星河',
    );
    expect(screen.queryByLabelText('采购/工厂产品编码')).not.toBeInTheDocument();
    expect(screen.getByLabelText('预计完成日期')).toBeInTheDocument();
    expect(screen.queryByText('重要英文标题')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('商品名称')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('销售产品编码 / 订货编码')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^货代 \/ 国际快递 \*/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^国内快递单号 \*/)).not.toBeInTheDocument();
  });

  it('hides draft sample editing actions from sales users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 201,
          sampleNo: 'SP202607080201',
          currentVersionNo: 1,
          currentStatus: 'draft',
          sourceQuoteOrderId: 66,
          sourceQuoteVersionNo: 3,
          sampleRequirements: 'Need draft sample',
          samplingCost: 0,
          orderCode: 'SO-SAMPLE-101',
          purchaseUnit: '',
          salesProductCode: '',
          internalProductCode: '',
          sampleQuantity: 0,
          estimatedCompletionDate: '',
        }),
      }),
    );

    const { default: AppSampleOrderDetailPage } = await import(
      '../app/app/sales/samples/[id]/page'
    );

    render(
      <>
        {await AppSampleOrderDetailPage({
          params: Promise.resolve({ id: '201' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getAllByText('draft / 草稿')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: '保存草稿' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '提交样品审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: '采购单位录入方式' }),
    ).not.toBeInTheDocument();
  });

  it('shows purchase sample execution fields to purchase users without sales-only fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 101,
        sampleNo: 'SP202607080101',
        currentVersionNo: 2,
        currentStatus: 'sampling',
        sourceQuoteOrderId: 66,
        sourceQuoteVersionNo: 3,
        sampleRequirements: 'Need blue shell sample',
        samplingCost: 18.5,
        importantEnglishTitle: 'Blue Shell Sample',
        orderCode: 'SO-SAMPLE-101',
        purchaseUnit: '深圳星河工厂',
        salesProductCode: 'SALE-BLUE-101',
        internalProductCode: 'SUP001-101',
        imageUrls: ['http://127.0.0.1:3001/uploads/samples/blue-shell.png'],
        sampleQuantity: 8,
        estimatedCompletionDate: '2026-07-28',
        freightForwarder: 'DHL',
        domesticTrackingNo: 'SF123456789CN',
        domesticCourierFee: 35,
        internationalCourierFee: 120,
        estimatedArrivalDate: '2026-08-03',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppSampleOrderDetailPage } = await import(
      '../app/app/sales/samples/[id]/page'
    );

    render(
      <>
        {await AppSampleOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '样品单 SP202607080101' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '打样执行信息' })).toBeInTheDocument();
    expect(screen.getByText('产品编码：SALE-BLUE-101')).toBeInTheDocument();
    expect(screen.getByText('深圳星河工厂')).toBeInTheDocument();
    expect(screen.getByText('DHL')).toBeInTheDocument();
    expect(screen.getByText('SF123456789CN')).toBeInTheDocument();
    expect(screen.getByText('国内快递费用：35')).toBeInTheDocument();
    expect(screen.getByText('国际快递费用：120')).toBeInTheDocument();
    expect(screen.getByText('预计完成日期：2026-07-28')).toBeInTheDocument();
    expect(screen.getByText('预计到达日期：2026-08-03')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '开始打样' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '标记已寄样' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^货代 \/ 国际快递 \*/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^国内快递单号 \*/)).toBeInTheDocument();
    expect(screen.getByLabelText('国内快递费用')).toBeInTheDocument();
    expect(screen.getByAltText('样品单 SP202607080101 图片 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/samples/blue-shell.png',
    );
    expect(screen.queryByText('Blue Shell Sample')).not.toBeInTheDocument();
    expect(screen.queryByText('SALE-BLUE-101')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '销售可见字段' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '采购执行字段' }),
    ).not.toBeInTheDocument();
  });

  it('allows admin users to execute the next sample action even with scoped access params', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/formal-lookup/counterparties?type=supplier&status=active')) {
          return {
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 11,
                  type: 'supplier',
                  code: 'SUP-BLUE',
                  name: '深圳星河工厂',
                  shortName: '星河',
                  status: 'active',
                },
              ],
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            id: 104,
            sampleNo: 'SP202607080104',
            currentVersionNo: 1,
            currentStatus: 'pending_sampling',
            sourceQuoteOrderId: 66,
            sourceQuoteVersionNo: 3,
            sampleRequirements: 'Need admin execution sample',
            samplingCost: 18.5,
          }),
        };
      }),
    );

    const { default: AppSampleOrderDetailPage } = await import(
      '../app/app/sales/samples/[id]/page'
    );

    render(
      <>
        {await AppSampleOrderDetailPage({
          params: Promise.resolve({ id: '104' }),
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['sales', 'purchase', 'operations', 'boss_dashboard', 'audit', 'admin'],
                dataScope: 'all',
                actions: ['sales.sample.submit'],
              }),
            ),
          }),
        })}
      </>,
    );

    expect(screen.getAllByText('pending_sampling / 待打样')).not.toHaveLength(0);
    expect(screen.getByText('下一步：采购开始打样')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始打样' })).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: '采购单位录入方式' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: '采购单位' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('采购/工厂产品编码')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('预计完成日期')).not.toBeInTheDocument();
    expect(screen.queryByText('无权限执行：采购样品执行')).not.toBeInTheDocument();
  });

  it('shows only approval actions while a sample order waits for approval', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 102,
          sampleNo: 'SP202607080102',
          currentVersionNo: 1,
          currentStatus: 'pending_approval',
          sourceQuoteOrderId: 66,
          sourceQuoteVersionNo: 3,
          sampleRequirements: 'Need approval sample',
          samplingCost: 18.5,
        }),
      }),
    );

    const { default: AppSampleOrderDetailPage } = await import(
      '../app/app/sales/samples/[id]/page'
    );

    render(
      <>
        {await AppSampleOrderDetailPage({
          params: Promise.resolve({ id: '102' }),
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '通过样品审批' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '驳回样品审批' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '提交样品审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '开始打样' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '客户确认样品' }),
    ).not.toBeInTheDocument();
  });

  it('shows only sales feedback actions after a sample has been sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 103,
          sampleNo: 'SP202607080103',
          currentVersionNo: 1,
          currentStatus: 'sample_sent',
          sourceQuoteOrderId: 66,
          sourceQuoteVersionNo: 3,
          sampleRequirements: 'Need customer feedback sample',
          samplingCost: 18.5,
        }),
      }),
    );

    const { default: AppSampleOrderDetailPage } = await import(
      '../app/app/sales/samples/[id]/page'
    );

    render(
      <>
        {await AppSampleOrderDetailPage({
          params: Promise.resolve({ id: '103' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '客户下单' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再次打样' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '无后续' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '客户确认样品' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '创建替代版本' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '取消样品单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        '已寄样后按客户反馈选择：客户下单、再次打样或无后续。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '提交样品审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '通过样品审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '开始打样' }),
    ).not.toBeInTheDocument();
  });
});
