import { createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REDIRECT_ERROR_CODE,
  RedirectType,
} from 'next/dist/client/components/redirect-error';
import {
  autosaveFormalQuoteDraftAction,
  buildCreateFormalQuotePayload,
  createFormalQuoteAction,
  updateFormalQuoteDraftAction,
} from '../app/app/sales/quotes/new/actions';
import { CreateFormalQuoteForm } from '../app/app/sales/quotes/new/create-formal-quote-form';
import AppNewFormalQuotePage from '../app/app/sales/quotes/new/page';

function createImageFile(name: string, content: string, type = 'image/png') {
  return new File([content], name, { type });
}

function createJsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((href: string) => {
    const error = new Error('NEXT_REDIRECT');
    (error as Error & { digest: string }).digest = [
      REDIRECT_ERROR_CODE,
      RedirectType.push,
      href,
      '303',
      '',
    ].join(';');
    throw error;
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

const defaultSalesUsers = [
  { id: 2001, label: 'Zoe / 销售 Zoe' },
  { id: 2002, label: 'Leo / 销售 Leo' },
  { id: 2000, label: 'Mia / 销售主管 Mia' },
];

const defaultSourceOptions = [
  { code: 'expo', label: '线下展会', enabled: true, sortOrder: 1 },
  { code: 'online', label: '线上', enabled: true, sortOrder: 2 },
  { code: 'tiktok', label: 'TikTok', enabled: true, sortOrder: 3 },
];

const defaultProductOptions = [
  {
    id: 1,
    sku: 'SKU-LED-001',
    nameCn: '智能 LED 灯带',
    nameEn: 'Smart LED Strip',
    productStage: 'formal' as const,
    category: 'electronics' as const,
    unit: 'set',
    pricingMode: 'tiered' as const,
    defaultSalePrice: 15.9,
    defaultPurchasePrice: 8.5,
    salePriceTiers: [
      { id: 1, minQuantity: 1, salePrice: 15.9, currency: 'USD', status: 'active' },
      { id: 2, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' },
    ],
  },
];

function getTodayDateValueForTest() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

describe('formal quote create page', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    vi.unstubAllGlobals();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: File) => `blob:test-${file.name}`),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('renders the formal quote create page with bilingual labels', async () => {
    render(
      <>
        {await AppNewFormalQuotePage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式新建需求和报价' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式需求和报价列表' }),
    ).toHaveAttribute('href', '/app/sales/quotes');
    expect(screen.getByLabelText('询单日期 Inquiry Date')).toHaveValue(getTodayDateValueForTest());
    expect(screen.queryByLabelText('当前进度 Current Status')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '客户录入方式 Customer Mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '从往来单位选择' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '手动填写客户' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      screen.getByText((_, element) => element?.textContent === '客户 Customer *'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择往来单位' })).toBeInTheDocument();
    expect(screen.getByLabelText('客户编码 Customer Code')).toHaveValue('');
    expect(screen.getByLabelText('客户名称 Customer Name')).toHaveValue('');
    expect(screen.getByLabelText('销售负责人 Sales Owner')).toHaveValue('2002');
    expect(screen.getByLabelText('销售负责人 Sales Owner')).toBeDisabled();
    expect(screen.getAllByRole('option', { name: 'Leo / 销售 Leo' })).toHaveLength(1);
    expect(screen.getByLabelText('目的地 Destination')).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === '需求明细 Line Item *'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '选择产品库产品 Product Picker' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('数量 Quantity')).toHaveValue(1);
    expect(screen.getByLabelText('客户目标价 Target Price')).toHaveValue(0);
    expect(screen.getByLabelText('销售单价 Sale Price')).toHaveValue(0);
    expect(screen.getByLabelText('上传图片 Upload Images')).toHaveAttribute('type', 'file');
    expect(screen.getByLabelText('来源渠道 Source Code')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '线上 / online' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'TikTok / tiktok' })).toBeInTheDocument();
    expect(screen.queryByLabelText('产品编码 Product Code')).not.toBeInTheDocument();
    expect(screen.getByLabelText('需求说明 Requirements')).toBeInTheDocument();
    expect(screen.getByLabelText('附件 Attachments')).toHaveAttribute('type', 'file');
    expect(screen.getByRole('button', { name: '保存需求草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交需求单' })).toBeInTheDocument();
  });

  it('switches customer mode from existing to manual with explicit buttons', () => {
    render(
      <CreateFormalQuoteForm
        customerOptions={[
          {
            id: 1,
            type: 'customer',
            code: 'CP-GLOBAL',
            name: '环球伙伴',
          },
        ]}
        productOptions={defaultProductOptions}
        salesUsers={defaultSalesUsers}
        sourceOptions={defaultSourceOptions}
        defaultSalesUserId={2001}
        role="sales"
        user="Zoe"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '手动填写客户' }));

    expect(screen.getByRole('button', { name: '手动填写客户' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('客户编码 Customer Code')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('客户名称 Customer Name')).not.toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: '选择往来单位' })).not.toBeInTheDocument();
  });

  it('allows editing inquiry date while defaulting it to today', () => {
    render(
      <CreateFormalQuoteForm
        customerOptions={[]}
        productOptions={defaultProductOptions}
        salesUsers={defaultSalesUsers}
        sourceOptions={defaultSourceOptions}
        defaultSalesUserId={2002}
        role="sales"
        user="Leo"
      />,
    );

    const inquiryDateInput = screen.getByLabelText('询单日期 Inquiry Date');
    expect(inquiryDateInput).toHaveValue(getTodayDateValueForTest());

    fireEvent.change(inquiryDateInput, { target: { value: '2026-07-20' } });
    expect(inquiryDateInput).toHaveValue('2026-07-20');
  });

  it('allows sales managers to select themselves and all sales users', async () => {
    render(
      <>
        {await AppNewFormalQuotePage({
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    const salesOwnerSelect = screen.getByLabelText('销售负责人 Sales Owner');
    expect(salesOwnerSelect).toHaveValue('2000');
    expect(salesOwnerSelect).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Zoe / 销售 Zoe' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Leo / 销售 Leo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mia / 销售主管 Mia' })).toBeInTheDocument();
  });

  it('allows admins to select all sales users and sales managers', async () => {
    render(
      <>
        {await AppNewFormalQuotePage({
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    const salesOwnerSelect = screen.getByLabelText('销售负责人 Sales Owner');
    expect(salesOwnerSelect).toHaveValue('2001');
    expect(salesOwnerSelect).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Zoe / 销售 Zoe' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Leo / 销售 Leo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mia / 销售主管 Mia' })).toBeInTheDocument();
  });

  it('blocks purchase users from directly opening the formal quote create page', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppNewFormalQuotePage({
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式新建需求和报价' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '无权限创建正式需求和报价' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('button', { name: '创建报价' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes the formal quote creation payload', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('customerName', 'Acme Trading');
    formData.set('customerCode', 'CUST-ACME');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'tiktok');
    formData.set('inquiryDate', '2026-07-18');
    formData.set('destination', 'Los Angeles');
    formData.set('requirements', 'Need 500 units');
    formData.set('productOption', '1|SKU-LED-001|智能 LED 灯带|set|15.9');
    formData.set('quantity', '500');
    formData.set('targetPrice', '12.8');
    formData.set('salePrice', '15.9');
    formData.set('submitMode', 'submit');
    formData.append('imageFiles', createImageFile('a.png', 'image-a'));
    formData.append('imageFiles', createImageFile('b.png', 'image-b'));
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        items: [
          {
            key: 'formal-quotes/2026/07/20/a.png',
            url: 'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/a.png',
          },
          {
            key: 'formal-quotes/2026/07/20/b.png',
            url: 'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/b.png',
          },
        ],
      }, { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(buildCreateFormalQuotePayload(formData)).resolves.toEqual({
      submitMode: 'submit',
      documentType: 'demand',
      productSource: 'existing',
      customerId: 1,
      customerEntryMode: 'existing',
      customerName: 'Acme Trading',
      customerCode: 'CUST-ACME',
      salesUserId: 2002,
      sourceCode: 'tiktok',
      inquiryDate: '2026-07-18',
      destination: 'Los Angeles',
      requirements: 'Need 500 units',
      items: [
        {
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          quantity: 500,
          targetPrice: 12.8,
          salePrice: 15.9,
          imageUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/a.png',
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/b.png',
          ],
        },
      ],
      quoteAttachments: undefined,
      role: 'sales',
      user: 'Leo',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/files/formal-quote-images',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-erp-role': 'sales',
          'x-erp-user': 'Leo',
        }),
        body: expect.any(FormData),
      }),
    );
  });

  it('normalizes a candidate product payload for formal quote creation', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'manual');
    formData.set('customerName', 'Manual Customer');
    formData.set('customerCode', 'TEMP-MANUAL');
    formData.set('saveManualCustomerToCounterparty', 'on');
    formData.set('submitMode', 'draft');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-18');
    formData.set('destination', 'Hamburg');
    formData.set('requirements', 'Need new candidate product');
    formData.set('productEntryMode', 'candidate');
    formData.set('candidateNameCn', '报价新品');
    formData.set('candidateCategory', 'electronics');
    formData.set('quantity', '50');
    formData.set('targetPrice', '98');
    formData.set('salePrice', '120');
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    await expect(buildCreateFormalQuotePayload(formData)).resolves.toEqual({
      submitMode: 'draft',
      documentType: 'demand',
      productSource: 'candidate',
      customerEntryMode: 'manual',
      customerName: 'Manual Customer',
      customerCode: 'TEMP-MANUAL',
      saveManualCustomerToCounterparty: true,
      salesUserId: 2002,
      sourceCode: 'expo',
      inquiryDate: '2026-07-18',
      destination: 'Hamburg',
      requirements: 'Need new candidate product',
      items: [
        {
          createCandidateProduct: {
            sku: '',
            nameCn: '报价新品',
            category: 'electronics',
          },
          quantity: 50,
          targetPrice: 98,
          salePrice: 120,
          imageUrls: [],
        },
      ],
      quoteAttachments: undefined,
      role: 'sales',
      user: 'Leo',
    });
  });

  it('hides existing product fields when switching to candidate product mode', async () => {
    render(
      <>
        {await AppNewFormalQuotePage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Leo',
          }),
        })}
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: '手填新产品' }));

    expect(
      screen.queryByRole('button', { name: '选择产品库产品 Product Picker' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('数量 Quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('客户目标价 Target Price')).toBeInTheDocument();
    expect(screen.getByLabelText('销售单价 Sale Price')).toBeInTheDocument();
    expect(screen.getByLabelText('产品编码 Product Code')).toBeInTheDocument();
    expect(screen.getByLabelText('产品名称 Product Name')).toBeInTheDocument();
    expect(screen.getByLabelText('产品类别 Product Category')).toBeInTheDocument();
    expect(screen.queryByLabelText('提交采购建档 Submit for Product Setup')).not.toBeInTheDocument();
  });

  it('recalculates sale price from tiered product pricing when quantity changes', () => {
    render(
      <CreateFormalQuoteForm
        customerOptions={[]}
        productOptions={defaultProductOptions}
        salesUsers={defaultSalesUsers}
        sourceOptions={defaultSourceOptions}
        defaultSalesUserId={2001}
        role="sales"
        user="Leo"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '选择产品库产品 Product Picker' }));
    expect(screen.getByRole('dialog', { name: '选择产品库产品' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('搜索产品 Search Product'), {
      target: { value: 'LED' },
    });
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    expect(screen.getByLabelText('销售单价 Sale Price')).toHaveValue(15.9);

    fireEvent.change(screen.getByLabelText('数量 Quantity'), {
      target: { value: '120' },
    });

    expect(screen.getByLabelText('销售单价 Sale Price')).toHaveValue(14.5);
  });

  it('opens uploaded quote images in an in-page viewer instead of a new tab', () => {
    render(
      <CreateFormalQuoteForm
        customerOptions={[]}
        productOptions={defaultProductOptions}
        salesUsers={defaultSalesUsers}
        sourceOptions={defaultSourceOptions}
        defaultSalesUserId={2001}
        role="sales"
        user="Leo"
      />,
    );

    fireEvent.change(screen.getByLabelText('上传图片 Upload Images'), {
      target: {
        files: [
          createImageFile('front.png', 'front'),
          createImageFile('side.png', 'side'),
        ],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /front.png/ }));

    expect(screen.getByRole('dialog', { name: '图片预览' })).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一张' }));
    const imageDialog = screen.getByRole('dialog', { name: '图片预览' });
    expect(within(imageDialog).getByText('side.png')).toBeInTheDocument();
    expect(within(imageDialog).getByText('2 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog', { name: '图片预览' })).not.toBeInTheDocument();
  });

  it('keeps customer empty by default and only allows customer counterparties in the picker', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/formal-lookup/counterparties?type=customer&status=active')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                id: 1,
                type: 'customer',
                code: 'CUST-ACME',
                name: '上海星河贸易有限公司',
                shortName: '星河贸易',
                status: 'active',
              },
              {
                id: 4,
                type: 'customer',
                code: 'TEST-KEHU-01',
                name: '测试客户01',
                shortName: '测试客户01',
                status: 'active',
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: false,
        json: async () => null,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppNewFormalQuotePage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByLabelText('客户编码 Customer Code')).toHaveValue('');
    expect(screen.getByLabelText('客户名称 Customer Name')).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: '选择往来单位' }));
    expect(screen.getByText('CUST-ACME')).toBeInTheDocument();
    expect(screen.queryByText('SUP-BRAVO')).not.toBeInTheDocument();
    expect(screen.queryByText('CP-GLOBAL')).not.toBeInTheDocument();
    expect(screen.getByText('测试客户01')).toBeInTheDocument();
    expect(screen.getByText('星河贸易 / Acme Trading')).toBeInTheDocument();
    expect(screen.queryByText(/环球伙伴/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '选择' })[0] as HTMLButtonElement);

    expect(screen.getByLabelText('客户编码 Customer Code')).toHaveValue('CUST-ACME');
    expect(screen.getByLabelText('客户名称 Customer Name')).toHaveValue('星河贸易 / Acme Trading');
  });

  it('renders customer picker as searchable paginated dialog', () => {
    const manyCustomers = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      type: index % 2 === 0 ? 'customer' as const : 'both' as const,
      code: `CUST-${String(index + 1).padStart(3, '0')}`,
      name: `Customer ${index + 1}`,
    }));

    render(
      <CreateFormalQuoteForm
        customerOptions={manyCustomers}
        productOptions={defaultProductOptions}
        salesUsers={defaultSalesUsers}
        sourceOptions={defaultSourceOptions}
        defaultSalesUserId={2001}
        role="sales"
        user="Leo"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '选择往来单位' }));

    expect(screen.getByRole('heading', { name: '选择往来单位' })).toBeInTheDocument();
    expect(screen.getByLabelText('搜索往来单位 Search Counterparty')).toBeInTheDocument();
    expect(screen.getByText('第 1 / 2 页')).toBeInTheDocument();
    expect(screen.getByText('CUST-001')).toBeInTheDocument();
    expect(screen.queryByText('CUST-009')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('第 2 / 2 页')).toBeInTheDocument();
    expect(screen.getByText('CUST-009')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('搜索往来单位 Search Counterparty'), {
      target: { value: 'Customer 12' },
    });
    expect(screen.getByText('第 1 / 1 页')).toBeInTheDocument();
    expect(screen.getByText('CUST-012')).toBeInTheDocument();
    expect(screen.queryByText('CUST-001')).not.toBeInTheDocument();
  });

  it('prevents enter key in customer search from submitting the outer quote form', () => {
    render(
      <CreateFormalQuoteForm
        customerOptions={[
          { id: 1, type: 'customer', code: 'CUST-001', name: 'Customer 1' },
          { id: 2, type: 'both', code: 'CP-002', name: 'Customer 2' },
        ]}
        productOptions={defaultProductOptions}
        salesUsers={defaultSalesUsers}
        sourceOptions={defaultSourceOptions}
        defaultSalesUserId={2001}
        role="sales"
        user="Leo"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '选择往来单位' }));
    const searchInput = screen.getByLabelText('搜索往来单位 Search Counterparty');
    const enterEvent = createEvent.keyDown(searchInput, {
      key: 'Enter',
      code: 'Enter',
      charCode: 13,
    });

    fireEvent(searchInput, enterEvent);

    expect(enterEvent.defaultPrevented).toBe(true);
    expect(screen.getByRole('heading', { name: '选择往来单位' })).toBeInTheDocument();
  });

  it('blocks submit and shows a validation error when customer and product are missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppNewFormalQuotePage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Leo',
          }),
        })}
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: '提交需求单' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('客户和产品为必填项，请先选择后再创建报价');
    expect(screen.getByText('请选择往来单位后再创建报价')).toBeInTheDocument();
    expect(screen.getByText('请选择商品或切换为候选产品后再创建报价')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes',
      expect.anything(),
    );
  });

  it('does not emit a React border shorthand warning when validation highlights customer fields', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    render(
      <>
        {await AppNewFormalQuotePage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Leo',
          }),
        })}
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: '提交需求单' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('客户和产品为必填项，请先选择后再创建报价');
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        call.some(
          (value) =>
            typeof value === 'string' &&
            value.includes('Removing a style property during rerender (borderColor)'),
        ),
      ),
    ).toBe(false);
  });

  it('returns a validation error before posting when required customer and product fields are missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-18');
    formData.set('destination', 'Seattle');
    formData.set('requirements', 'Need 500 units');
    formData.set('quantity', '500');
    formData.set('targetPrice', '14');
    formData.set('salePrice', '15.9');
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    await expect(createFormalQuoteAction({ error: null }, formData)).resolves.toEqual({
      error: '客户和产品为必填项，请先选择后再创建报价',
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows a candidate product without a unit and posts the quote payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({ id: 104, quoteNo: 'Q202607080104' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.set('customerEntryMode', 'manual');
    formData.set('customerName', 'Manual Customer');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-18');
    formData.set('destination', 'Seattle');
    formData.set('requirements', 'Need 500 units');
    formData.set('productEntryMode', 'candidate');
    formData.set('candidateNameCn', '报价新品');
    formData.set('candidateCategory', 'electronics');
    formData.set('quantity', '500');
    formData.set('targetPrice', '14');
    formData.set('salePrice', '15.9');
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    await expect(createFormalQuoteAction({ error: null }, formData)).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/sales/quotes/104?role=sales&user=Leo;303;`,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"nameCn":"报价新品"'),
      }),
    );
  });

  it('redirects submitted candidate demands back to demand detail when an inquiry is created', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        id: 118,
        quoteNo: 'BJ-2026-08-09-0003',
        linkedInquiryId: 116,
        linkedInquiryNo: 'IQ202607080116',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.set('customerEntryMode', 'manual');
    formData.set('customerName', 'Manual Customer');
    formData.set('customerCode', 'TEMP-MANUAL');
    formData.set('submitMode', 'submit');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-18');
    formData.set('destination', 'Hamburg');
    formData.set('requirements', 'Need new candidate product');
    formData.set('productEntryMode', 'candidate');
    formData.set('candidateNameCn', '报价新品');
    formData.set('candidateCategory', 'electronics');
    formData.set('quantity', '50');
    formData.set('targetPrice', '98');
    formData.set('salePrice', '120');
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    await expect(createFormalQuoteAction({ error: null }, formData)).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/sales/quotes/118?role=sales&user=Leo;303;`,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"documentType":"demand"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes',
      expect.objectContaining({
        body: expect.stringContaining('"productSource":"candidate"'),
      }),
    );
  });

  it('posts the normalized formal demand payload and redirects to demand detail after submit', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('customerName', 'Acme Trading');
    formData.set('customerCode', 'CUST-ACME');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-18');
    formData.set('destination', 'New York');
    formData.set('requirements', 'Need 500 units');
    formData.set('productOption', '1|SKU-LED-001|智能 LED 灯带|set|15.9');
    formData.set('quantity', '500');
    formData.set('targetPrice', '14.2');
    formData.set('salePrice', '15.9');
    formData.set('submitMode', 'submit');
    formData.append('imageFiles', createImageFile('a.png', 'image-a'));
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          createJsonResponse(
            {
              items: [
                {
                  key: 'formal-quotes/2026/07/20/a.png',
                  url: 'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/a.png',
                },
              ],
            },
            { status: 201 },
          ),
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            id: 102,
            quoteNo: 'XQ-2026-08-09-0002',
            status: 'submitted',
          }),
        ),
    );

    await expect(
      createFormalQuoteAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/sales/quotes/102?role=sales&user=Leo;303;`,
    });

    expect(fetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:3001/api/quotes', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-erp-role': 'sales',
        'x-erp-user': 'Leo',
        'x-erp-actions': expect.stringContaining('sales.quote.write'),
      }),
      body: JSON.stringify({
        submitMode: 'submit',
        documentType: 'demand',
        productSource: 'existing',
        customerId: 1,
        customerEntryMode: 'existing',
        customerName: 'Acme Trading',
        customerCode: 'CUST-ACME',
        salesUserId: 2002,
        sourceCode: 'expo',
        inquiryDate: '2026-07-18',
        destination: 'New York',
        requirements: 'Need 500 units',
        items: [
          {
            productId: 1,
            sku: 'SKU-LED-001',
            productName: '智能 LED 灯带',
            unit: 'set',
            quantity: 500,
            targetPrice: 14.2,
            salePrice: 15.9,
            imageUrls: ['http://127.0.0.1:3001/uploads/formal-quotes/2026/07/20/a.png'],
          },
        ],
      }),
      cache: 'no-store',
    });
  });

  it('posts formal quote creation with dynamic action scopes from the form access payload', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('customerName', 'Acme Trading');
    formData.set('customerCode', 'CUST-ACME');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-18');
    formData.set('destination', 'Seattle');
    formData.set('requirements', 'Need 500 units');
    formData.set('productOption', '1|SKU-LED-001|智能 LED 灯带|set|15.9');
    formData.set('quantity', '500');
    formData.set('targetPrice', '14');
    formData.set('salePrice', '15.9');
    formData.set('role', 'sales');
    formData.set('user', 'Leo');
    formData.set(
      'access',
      encodeURIComponent(
        JSON.stringify({
          actions: ['sales.quote.write'],
        }),
      ),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createJsonResponse({ id: 103, quoteNo: 'Q202607080103' }),
      ),
    );

    await expect(
      createFormalQuoteAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/sales/quotes/103?role=sales&user=Leo;303;`,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-erp-role': 'sales',
          'x-erp-user': 'Leo',
          'x-erp-actions': 'sales.quote.write',
        }),
      }),
    );
  });

  it('updates a formal quote draft and preserves existing image urls', async () => {
    const formData = new FormData();
    formData.set('quoteId', '103');
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('selectedCustomerName', 'Acme Trading');
    formData.set('selectedCustomerCode', 'CUST-ACME');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-20');
    formData.set('destination', 'Seattle');
    formData.set('requirements', 'Updated draft requirements');
    formData.set('productOption', '1|SKU-LED-001|智能 LED 灯带|set|15.9');
    formData.set('quantity', '200');
    formData.set('targetPrice', '13.5');
    formData.set('salePrice', '16.8');
    formData.set('submitMode', 'draft');
    formData.set(
      'existingQuoteImageUrls',
      JSON.stringify(['http://127.0.0.1:3001/uploads/formal-quotes/existing.png']),
    );
    formData.set(
      'existingQuoteAttachments',
      JSON.stringify([
        {
          key: 'formal-quote-attachments/existing-spec.pdf',
          fileName: 'existing-spec.pdf',
          mimeType: 'application/pdf',
          size: 2048,
          url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/existing-spec.pdf',
        },
      ]),
    );
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createJsonResponse({ id: 103, quoteNo: 'Q202607080103' }),
      ),
    );

    await expect(
      updateFormalQuoteDraftAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/sales/quotes/103?role=sales&user=Leo;303;`,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes/103/draft',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-erp-role': 'sales',
          'x-erp-user': 'Leo',
        }),
        body: JSON.stringify({
          submitMode: 'draft',
          documentType: 'demand',
          customerId: 1,
          customerEntryMode: 'existing',
          customerName: 'Acme Trading',
          customerCode: 'CUST-ACME',
          salesUserId: 2002,
          sourceCode: 'expo',
          inquiryDate: '2026-07-20',
          destination: 'Seattle',
          requirements: 'Updated draft requirements',
          quoteAttachments: [
            {
              key: 'formal-quote-attachments/existing-spec.pdf',
              fileName: 'existing-spec.pdf',
              mimeType: 'application/pdf',
              size: 2048,
              url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/existing-spec.pdf',
            },
          ],
          items: [
            {
              productId: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 200,
              targetPrice: 13.5,
              salePrice: 16.8,
              imageUrls: ['http://127.0.0.1:3001/uploads/formal-quotes/existing.png'],
            },
          ],
        }),
        cache: 'no-store',
      }),
    );
  });

  it('removes saved quote images and attachments from the draft form payload', () => {
    const { container } = render(
      <CreateFormalQuoteForm
        customerOptions={[
          {
            id: 1,
            type: 'customer',
            code: 'CUST-ACME',
            name: '安可贸易',
            shortName: 'Acme Trading',
          },
        ]}
        productOptions={defaultProductOptions}
        salesUsers={defaultSalesUsers}
        sourceOptions={defaultSourceOptions}
        defaultSalesUserId={2002}
        role="sales"
        user="Leo"
        initialQuote={{
          id: 103,
          customerId: 1,
          customerEntryMode: 'existing',
          customerName: '安可贸易',
          customerCode: 'CUST-ACME',
          salesUserId: 2002,
          sourceCode: 'expo',
          inquiryDate: '2026-07-20',
          destination: 'Seattle',
          requirements: 'Saved media draft',
          documentType: 'demand',
          quoteAttachments: [
            {
              key: 'formal-quote-attachments/spec.pdf',
              fileName: '报价附件.pdf',
              mimeType: 'application/pdf',
              size: 2048,
              url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/spec.pdf',
            },
          ],
          items: [
            {
              lineNo: 1,
              productId: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 200,
              targetPrice: 13.5,
              salePrice: 16.8,
              imageUrls: [
                'http://127.0.0.1:3001/uploads/formal-quotes/existing.png',
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('img', { name: '已保存图片 1' })).toBeInTheDocument();
    expect(screen.getByText('报价附件.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '删除已保存图片 1' }));
    fireEvent.click(screen.getByRole('button', { name: '删除附件报价附件.pdf' }));

    expect(screen.queryByRole('img', { name: '已保存图片 1' })).not.toBeInTheDocument();
    expect(screen.queryByText('报价附件.pdf')).not.toBeInTheDocument();
    expect(
      container.querySelector<HTMLInputElement>('input[name="existingQuoteImageUrls"]')?.value,
    ).toBe('[]');
    expect(
      container.querySelector<HTMLInputElement>('input[name="existingQuoteAttachments"]')?.value,
    ).toBe('[]');
  });

  it('autosaves a complete formal quote draft without redirecting', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('selectedCustomerName', 'Acme Trading');
    formData.set('selectedCustomerCode', 'CUST-ACME');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-20');
    formData.set('destination', 'Seattle');
    formData.set('requirements', 'Autosaved draft requirements');
    formData.set('productOption', '1|SKU-LED-001|智能 LED 灯带|set|15.9');
    formData.set('quantity', '200');
    formData.set('targetPrice', '13.5');
    formData.set('salePrice', '16.8');
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createJsonResponse({ id: 104, quoteNo: 'Q202607080104' }),
      ),
    );

    await expect(autosaveFormalQuoteDraftAction(formData)).resolves.toMatchObject({
      error: null,
      quoteId: 104,
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"submitMode":"draft"'),
      }),
    );
  });

  it('autosaves image and attachment files and returns persisted file metadata', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('selectedCustomerName', 'Acme Trading');
    formData.set('selectedCustomerCode', 'CUST-ACME');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-20');
    formData.set('destination', 'Seattle');
    formData.set('requirements', 'Autosaved draft with files');
    formData.set('productOption', '1|SKU-LED-001|智能 LED 灯带|set|15.9');
    formData.set('quantity', '200');
    formData.set('targetPrice', '13.5');
    formData.set('salePrice', '16.8');
    formData.append('imageFiles', createImageFile('auto.png', 'image-a'));
    formData.append('quoteAttachmentFiles', createImageFile('auto-attach.png', 'image-b'));
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/files/formal-quote-images')) {
        return Promise.resolve(
          createJsonResponse({
            items: [
              {
                url: 'http://127.0.0.1:3001/uploads/formal-quotes/auto.png',
              },
            ],
          }, { status: 201 }),
        );
      }

      if (url.includes('/files/formal-quote-attachments')) {
        return Promise.resolve(
          createJsonResponse({
            items: [
              {
                key: 'formal-quote-attachments/auto-attach.png',
                fileName: 'auto-attach.png',
                mimeType: 'image/png',
                size: 7,
                url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/auto-attach.png',
              },
            ],
          }, { status: 201 }),
        );
      }

      return Promise.resolve(
        createJsonResponse({
          id: 105,
          quoteNo: 'Q202607080105',
          quoteAttachments: [
            {
              key: 'formal-quote-attachments/auto-attach.png',
              fileName: 'auto-attach.png',
              mimeType: 'image/png',
              size: 7,
              url: 'http://127.0.0.1:3001/uploads/formal-quote-attachments/auto-attach.png',
            },
          ],
          items: [
            {
              imageUrls: ['http://127.0.0.1:3001/uploads/formal-quotes/auto.png'],
            },
          ],
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(autosaveFormalQuoteDraftAction(formData)).resolves.toMatchObject({
      error: null,
      quoteId: 105,
      imageUrls: ['http://127.0.0.1:3001/uploads/formal-quotes/auto.png'],
      quoteAttachments: [
        expect.objectContaining({
          fileName: 'auto-attach.png',
        }),
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/files/formal-quote-images',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/files/formal-quote-attachments',
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/quotes',
      expect.objectContaining({
        body: expect.stringContaining('http://127.0.0.1:3001/uploads/formal-quotes/auto.png'),
      }),
    );
  });

  it('returns a friendly upload-size error when the quote API responds with plain text 413 content', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('customerName', 'Acme Trading');
    formData.set('customerCode', 'CUST-ACME');
    formData.set('salesUserId', '2002');
    formData.set('sourceCode', 'expo');
    formData.set('inquiryDate', '2026-07-20');
    formData.set('destination', 'New York');
    formData.set('requirements', 'Need high-resolution product photos');
    formData.set('productOption', '1|SKU-LED-001|智能 LED 灯带|set|15.9');
    formData.set('quantity', '500');
    formData.set('targetPrice', '14.2');
    formData.set('salePrice', '15.9');
    formData.append('imageFiles', createImageFile('huge.png', 'image-a'));
    formData.set('role', 'sales');
    formData.set('user', 'Leo');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => {
          throw new Error('not json');
        },
        text: async () => 'request entity too large',
      }),
    );

    await expect(
      createFormalQuoteAction({ error: null }, formData),
    ).resolves.toEqual({
      error: '上传图片过大，请压缩图片后重试',
    });
  });
});
