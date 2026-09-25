import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REDIRECT_ERROR_CODE,
  RedirectType,
} from 'next/dist/client/components/redirect-error';
import {
  autosaveSalesOrderDraftAction,
  buildCreateSalesOrderPayload,
  createSalesOrderAction,
  updateSalesOrderDraftAction,
} from '../app/app/sales/orders/new/actions';
import AppEditSalesOrderDraftPage from '../app/app/sales/orders/[id]/edit/page';
import AppNewSalesOrderPage from '../app/app/sales/orders/new/page';

function createUploadFile(name: string, content: string, type: string) {
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

function mockCounterpartyFetch(
  metadataSalesUsers?: Array<{
    id: number;
    username: string;
    realName: string;
    roleCode: string;
    status: string;
  }>,
) {
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
              name: 'Acme Trading',
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
              pricingMode: 'tiered',
              defaultSalePrice: 15.9,
              salePriceTiers: [
                { id: 1, minQuantity: 1, salePrice: 15.9, currency: 'USD', status: 'active' },
                { id: 2, minQuantity: 100, salePrice: 14.5, currency: 'USD', status: 'active' },
              ],
              status: 'active',
            },
            {
              id: 2,
              sku: 'SKU-CBL-002',
              nameCn: 'USB-C 线缆',
              nameEn: 'USB-C Cable',
              unit: 'pcs',
              pricingMode: 'fixed',
              defaultSalePrice: 4.8,
              salePriceTiers: [],
              status: 'active',
            },
            {
              id: 3,
              sku: 'SKU-MANUAL-003',
              nameCn: '待定价货品',
              nameEn: 'Unpriced Product',
              unit: 'pcs',
              pricingMode: 'fixed',
              defaultSalePrice: null,
              salePriceTiers: [],
              status: 'active',
            },
          ],
        }),
      });
    }

    if (url.includes('/quotes/create-metadata') && metadataSalesUsers) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          salesUsers: metadataSalesUsers,
          sourceOptions: [],
        }),
      });
    }

    if (url.includes('/sales-orders/111')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 111,
          salesNo: 'S202607110111',
          status: 'draft',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'not_started',
          shipmentAggregateStatus: 'not_started',
          customerId: 1,
          customerEntryMode: 'existing',
          customerName: 'Acme Trading',
          customerCode: 'CUST-ACME',
          title: '测试报价转销售单成交价保留',
          salesUserId: 2001,
          createdBy: 2001,
          items: [
            {
              lineNo: 1,
              productId: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              packageQuantity: 12,
              unitsPerPackage: 10,
              cartonQuantity: 6,
              outerCartonSizeCm: '60×40×30',
              outerCartonGrossWeightKg: 18.5,
              totalQuantity: 120,
              quantity: 120,
              unit: 'set',
              salePrice: 17.2,
              amount: 2064,
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
}

describe('formal sales order create page', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    vi.unstubAllGlobals();
  });

  it('renders the formal direct-create sales order page with bilingual fields', async () => {
    mockCounterpartyFetch();

    render(
      <>
        {await AppNewSalesOrderPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式新建销售单' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式销售单列表' }),
    ).toHaveAttribute('href', '/app/sales/orders');
    expect(screen.getByRole('group', { name: '订货单位录入方式 Ordering Mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '从客户主数据选择' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('订货单位 Ordering')).toHaveValue('');
    expect(screen.getByLabelText('客户编码 Customer Code')).toHaveValue('');
    expect(screen.getByRole('button', { name: '选择往来单位' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '选择往来单位' }));
    expect(screen.getByRole('columnheader', { name: '单位名称 / 中文名称' })).toBeInTheDocument();
    expect(screen.getByText('星河贸易')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    expect(screen.getByLabelText('订货单位 Ordering')).toHaveValue(
      'CUST-ACME / Acme Trading / 星河贸易',
    );
    expect(screen.getByLabelText('客户编码 Customer Code')).toHaveValue('CUST-ACME');
    fireEvent.click(screen.getByRole('button', { name: '选择往来单位' }));
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    fireEvent.click(screen.getByRole('button', { name: '手动填写订货单位' }));
    expect(screen.getByLabelText('订货单位 Ordering')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('客户编码 Customer Code')).toHaveAttribute('type', 'text');
    expect(screen.getByText('同步保存到往来单位 Save to Counterparty')).toBeInTheDocument();
    expect(screen.getByLabelText('客户订单号 Customer PO No')).not.toHaveAttribute('readonly');
    expect(document.querySelector('form')).toHaveAttribute('novalidate');
    expect(screen.getByLabelText('门店 Store')).toBeInTheDocument();
    expect(screen.getByLabelText('订货日期 Order Date')).toBeInTheDocument();
    expect(screen.getByLabelText('截止日期 Deadline')).toBeInTheDocument();
    expect(screen.getByLabelText('Ship to 发货至')).toBeInTheDocument();
    expect(screen.getByLabelText('订单标题 Title')).toBeInTheDocument();
    expect(screen.getByText('销售明细 Sales Line Items')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '明细行 1 录入方式 Entry Mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择已有货品' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByLabelText('货品编码/名称 Product')).toBeInTheDocument();
    expect(screen.getByLabelText('货品编码 Product No')).toBeInTheDocument();
    expect(screen.getByLabelText('货品名称 Product Name')).toBeInTheDocument();
    expect(screen.getByLabelText('单位 Unit')).toHaveValue('个/pc');
    fireEvent.click(screen.getByRole('button', { name: '选择货品' }));
    expect(screen.getByRole('dialog', { name: '选择货品' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('搜索货品 Search Product'), {
      target: { value: 'USB' },
    });
    expect(screen.getByText('USB-C 线缆')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '选择' }));
    expect(screen.queryByRole('dialog', { name: '选择货品' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('货品编码 Product No')).toHaveValue('SKU-CBL-002');
    expect(screen.getByLabelText('货品名称 Product Name')).toHaveValue('USB-C 线缆');
    expect(screen.getByLabelText('货品编码 Product No')).toBeDisabled();
    expect(screen.getByLabelText('货品名称 Product Name')).toBeDisabled();
    expect(screen.getByLabelText('单位 Unit')).toHaveValue('个/pc');
    expect(screen.getByLabelText('单价 Unit P')).toHaveValue(4.8);
    expect(screen.getByLabelText('单价 Unit P')).toBeDisabled();
    expect(
      screen.getByText('已按商品主数据价格锁定，数量变化时会自动匹配阶梯报价。'),
    ).toBeInTheDocument();
    expect(
      JSON.parse(
        document.querySelector<HTMLInputElement>('input[name="salesOrderItems"]')?.value ?? '[]',
      )[0],
    ).toMatchObject({
      productId: 2,
      sku: 'SKU-CBL-002',
      productName: 'USB-C 线缆',
      unit: '个/pc',
      salePrice: 4.8,
    });
    fireEvent.click(screen.getByRole('button', { name: '手动录入货品' }));
    expect(screen.getByLabelText('货品编码 Product No')).not.toBeDisabled();
    expect(screen.getByLabelText('货品名称 Product Name')).not.toBeDisabled();
    expect(screen.getByLabelText('单价 Unit P')).not.toBeDisabled();
    const factoryImagesInput = screen.getByLabelText('工厂图片 Factory Images');
    expect(factoryImagesInput).toHaveAttribute('type', 'file');
    expect(factoryImagesInput).toHaveAttribute('accept', 'image/*');
    expect(factoryImagesInput).toHaveAttribute('multiple');
    expect(screen.getByLabelText('数量/件 Quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('每件数量 Quan')).toBeInTheDocument();
    expect(screen.getByLabelText('总数量 Total Q')).toHaveValue('1');
    expect(screen.getByLabelText('单位 Unit')).toHaveValue('个/pc');
    fireEvent.change(screen.getByLabelText('单位 Unit'), { target: { value: '箱' } });
    expect(screen.getByLabelText('单位 Unit')).toHaveValue('箱');
    expect(screen.getByLabelText('单价 Unit P')).toHaveValue(4.8);
    expect(screen.getByLabelText('合计 Total')).toHaveValue('4.8');
    expect(screen.getByRole('button', { name: '新增产品行' })).toBeInTheDocument();
    expect(screen.getByLabelText('备注 Remark')).toBeInTheDocument();
    expect(screen.getByLabelText('销售单附件 Attachments')).toHaveAttribute('multiple');
    expect(screen.getByText('暂无已保存附件')).toBeInTheDocument();
    expect(
      screen.getByText('选择文件后不会自动上传，需点击保存草稿或提交审批。'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('销售负责人 Sales Owner')).toHaveValue('2001');
    expect(screen.getByLabelText('销售负责人 Sales Owner')).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Zoe / 销售 Zoe' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Leo / 销售 Leo' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Mia / 销售主管 Mia' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提交审批' })).toBeInTheDocument();
  });

  it('locks product sale price from master data and recalculates tiered prices by total quantity', async () => {
    mockCounterpartyFetch();

    render(
      <>
        {await AppNewSalesOrderPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: '选择货品' }));
    fireEvent.change(screen.getByLabelText('搜索货品 Search Product'), {
      target: { value: 'LED' },
    });
    fireEvent.click(screen.getByRole('button', { name: '选择' }));

    expect(screen.getByLabelText('货品编码 Product No')).toHaveValue('SKU-LED-001');
    expect(screen.getByLabelText('单价 Unit P')).toHaveValue(15.9);
    expect(screen.getByLabelText('单价 Unit P')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('数量/件 Quantity'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('每件数量 Quan'), {
      target: { value: '10' },
    });

    expect(screen.getByLabelText('总数量 Total Q')).toHaveValue('100');
    expect(screen.getByLabelText('单价 Unit P')).toHaveValue(14.5);
    expect(screen.getByLabelText('合计 Total')).toHaveValue('1450');
    expect(
      JSON.parse(
        document.querySelector<HTMLInputElement>('input[name="salesOrderItems"]')?.value ?? '[]',
      )[0],
    ).toMatchObject({
      productId: 1,
      sku: 'SKU-LED-001',
      salePrice: 14.5,
      amount: 1450,
    });

    fireEvent.click(screen.getByRole('button', { name: '选择货品' }));
    fireEvent.change(screen.getByLabelText('搜索货品 Search Product'), {
      target: { value: '待定价' },
    });
    fireEvent.click(screen.getByRole('button', { name: '选择' }));

    expect(screen.getByLabelText('货品编码 Product No')).toHaveValue('SKU-MANUAL-003');
    expect(screen.getByLabelText('货品名称 Product Name')).toHaveValue('待定价货品');
    expect(screen.getByLabelText('货品编码 Product No')).toBeDisabled();
    expect(screen.getByLabelText('货品名称 Product Name')).toBeDisabled();
    expect(screen.getByLabelText('单价 Unit P')).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText('单价 Unit P'), {
      target: { value: '9.6' },
    });
    expect(screen.getByLabelText('合计 Total')).toHaveValue('960');
    expect(
      JSON.parse(
        document.querySelector<HTMLInputElement>('input[name="salesOrderItems"]')?.value ?? '[]',
      )[0],
    ).toMatchObject({
      productId: 3,
      sku: 'SKU-MANUAL-003',
      salePrice: 9.6,
      amount: 960,
    });
  });

  it('preserves saved sales order prices when editing an existing order', async () => {
    mockCounterpartyFetch();

    render(
      <>
        {await AppEditSalesOrderDraftPage({
          params: Promise.resolve({ id: '111' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByLabelText('货品编码 Product No')).toHaveValue('SKU-LED-001');
    expect(screen.getByLabelText('数量/件 Quantity')).toHaveValue(12);
    expect(screen.getByLabelText('每件数量 Quan')).toHaveValue(10);
    expect(screen.getByLabelText('装箱数 Carton Qty')).toHaveValue(6);
    expect(screen.getByLabelText('外箱尺寸 Carton Size')).toHaveValue('60×40×30');
    expect(screen.getByLabelText('外箱毛重 Gross Weight')).toHaveValue(18.5);
    expect(screen.getByLabelText('总数量 Total Q')).toHaveValue('120');
    expect(screen.getByLabelText('单价 Unit P')).toHaveValue(17.2);
    expect(screen.getByLabelText('合计 Total')).toHaveValue('2064');
    expect(
      JSON.parse(
        document.querySelector<HTMLInputElement>('input[name="salesOrderItems"]')?.value ?? '[]',
      )[0],
    ).toMatchObject({
      productId: 1,
      sku: 'SKU-LED-001',
      salePrice: 17.2,
      amount: 2064,
      cartonQuantity: 6,
      outerCartonSizeCm: '60×40×30',
      outerCartonGrossWeightKg: 18.5,
    });
  });

  it('lets sales managers pick all sales users and themselves as sales owner', async () => {
    mockCounterpartyFetch([
      {
        id: 2001,
        username: 'zoe',
        realName: 'Zoe',
        roleCode: 'sales',
        status: 'active',
      },
      {
        id: 2002,
        username: 'leo',
        realName: 'Leo',
        roleCode: 'sales',
        status: 'active',
      },
    ]);

    render(
      <>
        {await AppNewSalesOrderPage({
          searchParams: Promise.resolve({
            role: 'sales_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByLabelText('销售负责人 Sales Owner')).not.toBeDisabled();
    expect(screen.getByRole('option', { name: 'Zoe / 销售 Zoe' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Leo / 销售 Leo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mia / 销售主管 Mia' })).toBeInTheDocument();
    expect(screen.getByLabelText('销售负责人 Sales Owner')).toHaveValue('2000');
  });

  it('lets boss users pick sales users, sales managers, and themselves as sales owner', async () => {
    mockCounterpartyFetch([
      {
        id: 2001,
        username: 'zoe',
        realName: 'Zoe',
        roleCode: 'sales',
        status: 'active',
      },
      {
        id: 2002,
        username: 'leo',
        realName: 'Leo',
        roleCode: 'sales',
        status: 'active',
      },
      {
        id: 2010,
        username: 'ana',
        realName: 'Ana',
        roleCode: 'sales_manager',
        status: 'active',
      },
    ]);

    render(
      <>
        {await AppNewSalesOrderPage({
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByLabelText('销售负责人 Sales Owner')).not.toBeDisabled();
    expect(screen.getByRole('option', { name: 'Zoe / 销售 Zoe' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Leo / 销售 Leo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana / 销售主管 Ana' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Mia / 老板 Mia' })).toBeInTheDocument();
    expect(screen.getByLabelText('销售负责人 Sales Owner')).toHaveValue('2000');
  });

  it('blocks purchase users from directly opening the formal sales order create page', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppNewSalesOrderPage({
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式新建销售单' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '无权限创建正式销售单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('button', { name: '保存草稿' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交审批' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes the direct sales order form payload', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('selectedCustomerName', 'Acme Trading');
    formData.set('selectedCustomerCode', 'CUST-ACME');
    formData.set('customerName', 'Acme Trading');
    formData.set('title', 'Acme 秋季促销补货');
    formData.set('salesUserId', '2001');
    formData.set('createdBy', '2001');
    formData.set('storeName', '02 Libuys');
    formData.set('orderDate', '2026-05-30');
    formData.set('estimatedDeliveryDate', '2026-06-08');
    formData.set('shipTo', 'SH Boninoe');
    formData.set('salesOrderRemark', '单个销售单可能会有多个工厂的产品');
    formData.set(
      'salesOrderItems',
      JSON.stringify([
        {
          lineNo: 1,
          clientLineId: undefined,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          factoryPicUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
          ],
          packageQuantity: 20,
          unitsPerPackage: 200,
          totalQuantity: 4000,
          quantity: 4000,
          unit: 'set',
          salePrice: 15.9,
          amount: 63600,
        },
      ]),
    );
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');

    await expect(buildCreateSalesOrderPayload(formData)).resolves.toEqual({
      submitMode: 'draft',
      customerId: 1,
      customerEntryMode: 'existing',
      customerName: 'Acme Trading',
      customerCode: 'CUST-ACME',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
      orderingUnit: '',
      customerOrderNo: '',
      storeName: '02 Libuys',
      orderDate: '2026-05-30',
      estimatedDeliveryDate: '2026-06-08',
      shipTo: 'SH Boninoe',
      salesOrderRemark: '单个销售单可能会有多个工厂的产品',
      items: [
        {
          lineNo: 1,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          factoryPicUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
          ],
          packageQuantity: 20,
          unitsPerPackage: 200,
          totalQuantity: 4000,
          quantity: 4000,
          unit: 'set',
          salePrice: 15.9,
          amount: 63600,
        },
      ],
      role: 'sales',
      user: 'Zoe',
    });
  });

  it('normalizes submitting a direct sales order for approval', async () => {
    const formData = new FormData();
    formData.set('customerName', 'Acme Trading');
    formData.set('title', 'Acme 秋季促销补货');
    formData.set('salesUserId', '2001');
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');
    formData.set('submitMode', 'submit');

    await expect(buildCreateSalesOrderPayload(formData)).resolves.toMatchObject({
      submitMode: 'submit',
      customerName: 'Acme Trading',
      title: 'Acme 秋季促销补货',
      salesUserId: 2001,
      createdBy: 2001,
    });
  });

  it('forces sales users to create orders under their own sales owner id', async () => {
    const formData = new FormData();
    formData.set('customerName', 'Acme Trading');
    formData.set('title', 'Acme 秋季促销补货');
    formData.set('salesUserId', '2002');
    formData.set('createdBy', '9000');
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');

    await expect(buildCreateSalesOrderPayload(formData)).resolves.toMatchObject({
      salesUserId: 2001,
      createdBy: 2001,
      role: 'sales',
      user: 'Zoe',
    });
  });

  it('normalizes manual ordering unit fields for optional counterparty save', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'manual');
    formData.set('customerName', 'Northwind Labs');
    formData.set('customerCode', 'cust-northwind');
    formData.set('saveManualCustomerToCounterparty', 'on');
    formData.set('title', 'Northwind 补货单');
    formData.set('salesUserId', '2001');
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');

    await expect(buildCreateSalesOrderPayload(formData)).resolves.toMatchObject({
      customerEntryMode: 'manual',
      customerName: 'Northwind Labs',
      customerCode: 'cust-northwind',
      saveManualCustomerToCounterparty: true,
      title: 'Northwind 补货单',
      salesUserId: 2001,
      createdBy: 2001,
    });
  });

  it('posts the normalized payload and redirects to the formal sales detail page', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('selectedCustomerName', 'Acme Trading');
    formData.set('selectedCustomerCode', 'CUST-ACME');
    formData.set('customerName', 'Acme Trading');
    formData.set('title', 'Acme 秋季促销补货');
    formData.set('salesUserId', '2001');
    formData.set('createdBy', '2001');
    formData.set('storeName', '02 Libuys');
    formData.set('orderDate', '2026-05-30');
    formData.set('estimatedDeliveryDate', '2026-06-08');
    formData.set('shipTo', 'SH Boninoe');
    formData.set('salesOrderRemark', '单个销售单可能会有多个工厂的产品');
    formData.set(
      'salesOrderItems',
      JSON.stringify([
        {
          lineNo: 1,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          factoryPicUrls: [
            'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
          ],
          packageQuantity: 20,
          unitsPerPackage: 200,
          totalQuantity: 4000,
          quantity: 4000,
          unit: 'set',
          salePrice: 15.9,
          amount: 63600,
        },
      ]),
    );
    formData.append(
      'salesOrderAttachmentFiles',
      createUploadFile('sales-image.png', 'sales-image', 'image/png'),
    );
    formData.append(
      'salesOrderAttachmentFiles',
      createUploadFile('sales-spec.pdf', 'sales-spec', 'application/pdf'),
    );
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
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
        }, { status: 201 }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ id: 108, salesNo: 'S202607080108' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createSalesOrderAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/sales/orders/108?role=sales&user=Zoe;303;`,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3001/api/files/sales-order-attachments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-erp-role': 'sales',
          'x-erp-user': 'Zoe',
          'x-erp-actions': expect.stringContaining('sales.order.write'),
        }),
        body: expect.any(FormData),
        cache: 'no-store',
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:3001/api/sales-orders', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-erp-role': 'sales',
        'x-erp-user': 'Zoe',
        'x-erp-actions': expect.stringContaining('sales.order.write'),
      }),
      body: JSON.stringify({
        submitMode: 'draft',
        customerId: 1,
        customerEntryMode: 'existing',
        customerName: 'Acme Trading',
        customerCode: 'CUST-ACME',
        title: 'Acme 秋季促销补货',
        salesUserId: 2001,
        createdBy: 2001,
        orderingUnit: '',
        customerOrderNo: '',
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
        items: [
          {
            lineNo: 1,
            productId: 1,
            sku: 'SKU-LED-001',
            productName: '智能 LED 灯带',
            factoryPicUrls: [
              'http://127.0.0.1:3001/uploads/formal-quotes/2026/07/21/quote-led.png',
            ],
            packageQuantity: 20,
            unitsPerPackage: 200,
            totalQuantity: 4000,
            quantity: 4000,
            unit: 'set',
            salePrice: 15.9,
            amount: 63600,
          },
        ],
      }),
      cache: 'no-store',
    });
  });

  it('uploads direct sales order line factory images into the item payload', async () => {
    const formData = new FormData();
    formData.set('customerName', 'Acme Trading');
    formData.set('title', 'Acme 秋季促销补货');
    formData.set('salesUserId', '2001');
    formData.set('createdBy', '2001');
    formData.set(
      'salesOrderItems',
      JSON.stringify([
        {
          clientLineId: 7,
          lineNo: 1,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          packageQuantity: 20,
          unitsPerPackage: 200,
          totalQuantity: 4000,
          quantity: 4000,
          unit: 'set',
          salePrice: 15.9,
          amount: 63600,
        },
      ]),
    );
    formData.append(
      'salesOrderItemFactoryPicFiles:7',
      createUploadFile('factory-a.png', 'factory-a', 'image/png'),
    );
    formData.append(
      'salesOrderItemFactoryPicFiles:7',
      createUploadFile('factory-b.jpg', 'factory-b', 'image/jpeg'),
    );
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createJsonResponse({
          items: [
            {
              key: 'sales-order-attachments/2026/07/24/factory-a.png',
              fileName: 'factory-a.png',
              mimeType: 'image/png',
              size: 9,
              url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/factory-a.png',
            },
            {
              key: 'sales-order-attachments/2026/07/24/factory-b.jpg',
              fileName: 'factory-b.jpg',
              mimeType: 'image/jpeg',
              size: 9,
              url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/factory-b.jpg',
            },
          ],
        }, { status: 201 }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({ id: 110, salesNo: 'S202607080110' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createSalesOrderAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/sales/orders/110?role=sales&user=Zoe;303;`,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:3001/api/files/sales-order-attachments',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:3001/api/sales-orders',
      expect.objectContaining({
        body: expect.stringContaining(
          '"factoryPicUrls":["http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/factory-a.png","http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/factory-b.jpg"]',
        ),
      }),
    );
    expect(String(fetchMock.mock.calls[1][1]?.body)).not.toContain('clientLineId');
  });

  it('posts direct sales order creation with dynamic action scopes from the form access payload', async () => {
    const formData = new FormData();
    formData.set('customerName', 'Acme Trading');
    formData.set('title', 'Acme 秋季促销补货');
    formData.set('salesUserId', '2001');
    formData.set('createdBy', '2001');
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');
    formData.set(
      'salesOrderItems',
      JSON.stringify([
        {
          lineNo: 1,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          packageQuantity: 1,
          unitsPerPackage: 10,
          totalQuantity: 10,
          quantity: 10,
          unit: 'set',
          salePrice: 15.9,
          amount: 159,
        },
      ]),
    );
    formData.set(
      'access',
      encodeURIComponent(
        JSON.stringify({
          actions: ['sales.order.write'],
        }),
      ),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 109, salesNo: 'S202607080109' }),
      }),
    );

    await expect(
      createSalesOrderAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/sales/orders/109?role=sales&user=Zoe;303;`,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/sales-orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          submitMode: 'draft',
          customerEntryMode: 'existing',
          customerName: 'Acme Trading',
          customerCode: '',
          title: 'Acme 秋季促销补货',
          salesUserId: 2001,
          createdBy: 2001,
          orderingUnit: '',
          customerOrderNo: '',
          storeName: '',
          orderDate: '',
          estimatedDeliveryDate: '',
          shipTo: '',
          salesOrderRemark: '',
          salesOrderAttachments: [],
          items: [
            {
              lineNo: 1,
              productId: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              packageQuantity: 1,
              unitsPerPackage: 10,
              totalQuantity: 10,
              quantity: 10,
              unit: 'set',
              salePrice: 15.9,
              amount: 159,
            },
          ],
        }),
        headers: expect.objectContaining({
          'x-erp-role': 'sales',
          'x-erp-user': 'Zoe',
          'x-erp-actions': 'sales.order.write',
        }),
      }),
    );
  });

  it('returns a visible error when saving a draft without customer and line items', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'manual');
    formData.set('customerName', '');
    formData.set('salesOrderItems', '[]');
    formData.set('salesUserId', '2001');
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');

    await expect(createSalesOrderAction({ error: null }, formData)).resolves.toEqual({
      error: '请完善订货单位、销售明细后再保存销售单草稿。',
    });
  });

  it('updates an existing draft sales order and keeps it as draft', async () => {
    const formData = new FormData();
    formData.set('salesOrderId', '108');
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('selectedCustomerName', 'Acme Trading');
    formData.set('selectedCustomerCode', 'CUST-ACME');
    formData.set('customerName', 'Acme Trading');
    formData.set('title', 'Acme 草稿继续保存');
    formData.set('salesUserId', '2001');
    formData.set('createdBy', '2001');
    formData.set('storeName', '02 Libuys');
    formData.set('orderDate', '2026-05-30');
    formData.set('estimatedDeliveryDate', '2026-06-08');
    formData.set('shipTo', 'SH Boninoe');
    formData.set('salesOrderRemark', '草稿继续补资料');
    formData.set('submitMode', 'draft');
    formData.set(
      'existingSalesOrderAttachments',
      JSON.stringify([
        {
          key: 'sales-order-attachments/2026/07/24/old.png',
          fileName: 'old.png',
          mimeType: 'image/png',
          size: 8,
          url: 'http://127.0.0.1:3001/uploads/sales-order-attachments/2026/07/24/old.png',
        },
      ]),
    );
    formData.set(
      'salesOrderItems',
      JSON.stringify([
        {
          clientLineId: 1,
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
          amount: 3180,
        },
      ]),
    );
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 108, salesNo: 'S202607110108', status: 'draft' }),
      }),
    );

    await expect(
      updateSalesOrderDraftAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/sales/orders/108?role=sales&user=Zoe;303;`,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/sales-orders/108/draft',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          submitMode: 'draft',
          customerId: 1,
          customerEntryMode: 'existing',
          customerName: 'Acme Trading',
          customerCode: 'CUST-ACME',
          title: 'Acme 草稿继续保存',
          salesUserId: 2001,
          createdBy: 2001,
          orderingUnit: '',
          customerOrderNo: '',
          storeName: '02 Libuys',
          orderDate: '2026-05-30',
          estimatedDeliveryDate: '2026-06-08',
          shipTo: 'SH Boninoe',
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
              amount: 3180,
            },
          ],
        }),
      }),
    );
  });

  it('autosaves a complete new sales order draft without redirecting', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('selectedCustomerName', 'Acme Trading');
    formData.set('selectedCustomerCode', 'CUST-ACME');
    formData.set('customerName', 'Acme Trading');
    formData.set('title', 'Acme 自动保存草稿');
    formData.set('salesUserId', '2001');
    formData.set('createdBy', '2001');
    formData.set('storeName', '02 Libuys');
    formData.set('orderDate', '2026-05-30');
    formData.set('estimatedDeliveryDate', '2026-06-08');
    formData.set('shipTo', 'SH Boninoe');
    formData.set('salesOrderRemark', '自动保存草稿');
    formData.set(
      'salesOrderItems',
      JSON.stringify([
        {
          clientLineId: 1,
          lineNo: 1,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          packageQuantity: 2,
          unitsPerPackage: 100,
          totalQuantity: 200,
          quantity: 200,
          unit: 'set',
          salePrice: 15.9,
          amount: 3180,
        },
      ]),
    );
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createJsonResponse({ id: 111, salesNo: 'S202607110111', status: 'draft' }),
      ),
    );

    await expect(autosaveSalesOrderDraftAction(formData)).resolves.toMatchObject({
      error: null,
      salesOrderId: 111,
    });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/sales-orders',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"submitMode":"draft"'),
      }),
    );
  });

  it('returns the saved default title for the new-order form', async () => {
    const formData = new FormData();
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('selectedCustomerName', 'Acme Trading');
    formData.set('customerName', 'Acme Trading');
    formData.set('title', '');
    formData.set('salesUserId', '2001');
    formData.set('createdBy', '2001');
    formData.set('salesOrderItems', JSON.stringify([{ lineNo: 1, sku: 'A', productName: '灯带一', unit: 'set', packageQuantity: 1, unitsPerPackage: 1, totalQuantity: 1, quantity: 1, salePrice: 10, amount: 10 }]));
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createJsonResponse({
      id: 112,
      salesNo: 'S202609250112',
      title: 'S202609250112-灯带一-Acme Trading',
      status: 'draft',
    })));

    await expect(autosaveSalesOrderDraftAction(formData)).resolves.toMatchObject({
      error: null,
      salesOrderId: 112,
      title: 'S202609250112-灯带一-Acme Trading',
    });
  });

  it('autosaves an existing sales order draft through the draft endpoint', async () => {
    const formData = new FormData();
    formData.set('salesOrderId', '108');
    formData.set('customerEntryMode', 'existing');
    formData.set('customerId', '1');
    formData.set('selectedCustomerName', 'Acme Trading');
    formData.set('selectedCustomerCode', 'CUST-ACME');
    formData.set('customerName', 'Acme Trading');
    formData.set('title', 'Acme 自动保存已有草稿');
    formData.set('salesUserId', '2001');
    formData.set('createdBy', '2001');
    formData.set(
      'salesOrderItems',
      JSON.stringify([
        {
          clientLineId: 1,
          lineNo: 1,
          productId: 1,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          packageQuantity: 2,
          unitsPerPackage: 100,
          totalQuantity: 200,
          quantity: 200,
          unit: 'set',
          salePrice: 15.9,
          amount: 3180,
        },
      ]),
    );
    formData.set('role', 'sales');
    formData.set('user', 'Zoe');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createJsonResponse({ id: 108, salesNo: 'S202607110108', status: 'draft' }),
      ),
    );

    await expect(autosaveSalesOrderDraftAction(formData)).resolves.toMatchObject({
      error: null,
      salesOrderId: 108,
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/sales-orders/108/draft',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"title":"Acme 自动保存已有草稿"'),
      }),
    );
  });
});
