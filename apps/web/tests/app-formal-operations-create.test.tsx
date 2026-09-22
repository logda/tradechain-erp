import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REDIRECT_ERROR_CODE,
  RedirectType,
} from 'next/dist/client/components/redirect-error';
import {
  buildCreateFormalShipmentBatchPayload,
  createFormalShipmentBatchAction,
} from '../app/app/shipment-batches/new/actions';
import {
  buildCreateFormalAfterSalesPayload,
  createFormalAfterSalesAction,
} from '../app/app/after-sales/new/actions';
import AppNewFormalShipmentBatchPage from '../app/app/shipment-batches/new/page';
import AppNewFormalAfterSalesPage from '../app/app/after-sales/new/page';

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

function mockCounterpartyFetch() {
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

describe('formal operations create pages', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    vi.unstubAllGlobals();
  });

  it('renders the formal shipment batch create page with bilingual fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          purchaseNo: 'P202607080101',
          status: 'purchasing',
          currentBatchCount: 0,
          sourceSalesOrderId: 88,
          salesOrderNo: 'S202607080001',
          supplierName: '星河供应',
          shipTo: 'SH Boninoe',
          factoryEstimatedDeliveryDate: '2026-08-08',
          items: [
            {
              lineNo: 1,
              sourceSalesItemId: 1,
              productId: 501,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              packageQuantity: 20,
            },
          ],
        }),
      }),
    );

    render(
      <>
        {await AppNewFormalShipmentBatchPage({
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
            salesOrderId: '88',
            purchaseOrderId: '101',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式新建发货批次' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式发货批次列表' }),
    ).toHaveAttribute('href', '/app/shipment-batches');
    expect(screen.getByLabelText('销售单 ID Sales Order')).toHaveValue(88);
    expect(screen.getByLabelText('采购单 ID Purchase Order')).toHaveValue(101);
    expect(screen.getByLabelText('订单号 Order No')).toHaveValue('S202607080001');
    expect(screen.getByLabelText('采购单号 Purchase No')).toHaveValue('P202607080101');
    expect(screen.getByLabelText('采购单位 Purchasing Unit')).toHaveValue('星河供应');
    expect(screen.getByLabelText('到货目的地 Destination')).toHaveValue('SH Boninoe');
    expect(screen.getByLabelText('货物名称 Goods Name')).toHaveValue('智能 LED 灯带');
    expect(screen.getByLabelText('总件数 Total Packages')).toHaveValue(20);
    expect(screen.getByLabelText('预计到货时间 Estimated Arrival')).toHaveValue('2026-08-08');
    expect(screen.getByLabelText('发货编码 Shipping Code')).toBeRequired();
    expect(screen.getByLabelText('货运站 Freight Station')).toBeRequired();
    expect(screen.getByLabelText('发货数量 Shipped Qty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建发货批次' })).toBeInTheDocument();
  });

  it('blocks sales users from directly opening the formal shipment batch create page', async () => {
    render(
      <>
        {await AppNewFormalShipmentBatchPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
            salesOrderId: '88',
            purchaseOrderId: '101',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式新建发货批次' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '无权限创建正式发货批次' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('button', { name: '创建发货批次' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('发货数量 Shipped Qty')).not.toBeInTheDocument();
  });

  it('normalizes the formal shipment batch payload and redirects to the formal detail page', async () => {
    const formData = new FormData();
    formData.set('salesOrderId', '9');
    formData.set('purchaseOrderId', '21');
    formData.set('shippedQty', '40');
    formData.set('accumulatedQty', '40');
    formData.set('remainingQty', '60');
    formData.set('shippedAt', '2026-07-11T09:00:00.000Z');
    formData.set('factoryShipDate', '2026-07-11');
    formData.set('shippingCode', 'SHIP-001, SHIP-002\nSHIP-003');
    formData.set('destination', 'SH Boninoe');
    formData.set('shippingMark', 'ACME-02');
    formData.set('goodsName', '智能 LED 灯带');
    formData.set('totalPackages', '20');
    formData.set('purchasingUnit', '星河供应');
    formData.set('customerName', 'Acme Trading');
    formData.set('freightStation', '上海货运站');
    formData.set('warehouseEntryNo', 'WH-IN-001');
    formData.set('arrivalStatus', '已发');
    formData.set('forwarderShipDate', '2026-07-12');
    formData.set('estimatedArrivalDate', '2026-08-08');
    formData.set('remark', '首批发货');
    formData.set('createdBy', '2002');
    formData.set('purchaseOrderCurrentStatus', 'purchasing');
    formData.set('currentBatchCount', '0');
    formData.set(
      'items',
      JSON.stringify([
        {
          purchaseLineNo: 1,
          sourceSalesItemId: 1,
          productId: 501,
          sku: 'SKU-LED-001',
          productName: '智能 LED 灯带',
          unit: 'set',
          shippedQty: 40,
          purchaseQty: 500,
        },
      ]),
    );
    formData.set('role', 'purchase');
    formData.set('user', 'Leo');

    await expect(buildCreateFormalShipmentBatchPayload(formData)).resolves.toEqual({
      salesOrderId: 9,
      purchaseOrderId: 21,
      shippedQty: 40,
      accumulatedQty: 40,
      remainingQty: 60,
      shippedAt: '2026-07-11T09:00:00.000Z',
      factoryShipDate: '2026-07-11',
      shippingCode: 'SHIP-001\nSHIP-002\nSHIP-003',
      destination: 'SH Boninoe',
      shippingMark: 'ACME-02',
      goodsName: '智能 LED 灯带',
      totalPackages: 20,
      purchasingUnit: '星河供应',
      customerName: 'Acme Trading',
      freightStation: '上海货运站',
      warehouseEntryNo: 'WH-IN-001',
      arrivalStatus: '已发',
      forwarderShipDate: '2026-07-12',
      estimatedArrivalDate: '2026-08-08',
      remark: '首批发货',
      createdBy: 2002,
      purchaseOrderCurrentStatus: 'purchasing',
      currentBatchCount: 0,
      items:
        '[{"purchaseLineNo":1,"sourceSalesItemId":1,"productId":501,"sku":"SKU-LED-001","productName":"智能 LED 灯带","unit":"set","shippedQty":40,"purchaseQty":500}]',
      role: 'purchase',
      user: 'Leo',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 301, batchNo: 'SH202607110301' }),
      }),
    );

    await expect(
      createFormalShipmentBatchAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/shipment-batches/301?role=purchase&user=Leo;303;`,
    });
  });

  it('posts formal shipment batch creation with dynamic action scopes from the form access payload', async () => {
    const formData = new FormData();
    formData.set('salesOrderId', '9');
    formData.set('purchaseOrderId', '21');
    formData.set('shippedQty', '40');
    formData.set('accumulatedQty', '40');
    formData.set('remainingQty', '60');
    formData.set('shippedAt', '2026-07-11T09:00:00.000Z');
    formData.set('createdBy', '2002');
    formData.set('purchaseOrderCurrentStatus', 'purchasing');
    formData.set('currentBatchCount', '0');
    formData.set('role', 'purchase');
    formData.set('user', 'Leo');
    formData.set(
      'access',
      encodeURIComponent(
        JSON.stringify({
          actions: ['shipment.update'],
        }),
      ),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 302, batchNo: 'SH202607110302' }),
      }),
    );

    await expect(
      createFormalShipmentBatchAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/shipment-batches/302?role=purchase&user=Leo;303;`,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/shipment-batches',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-erp-role': 'purchase',
          'x-erp-user': 'Leo',
          'x-erp-actions': 'shipment.update',
        }),
      }),
    );
  });

  it('renders the formal after-sales create page with bilingual fields', async () => {
    mockCounterpartyFetch();

    render(
      <>
        {await AppNewFormalAfterSalesPage({
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
            salesOrderId: '88',
            purchaseOrderId: '21',
            shipmentBatchId: '101',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式新建售后单' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式售后单列表' }),
    ).toHaveAttribute('href', '/app/after-sales');
    expect(screen.getByLabelText('客户 Customer')).toHaveValue(
      'CUST-ACME / Acme Trading / 星河贸易',
    );
    expect(screen.getByLabelText('供应商 Supplier')).toHaveValue(
      'SUP-BRAVO / 光源制造 / Bravo Industrial',
    );
    expect(screen.getByLabelText('销售单 ID Sales Order')).toHaveValue(88);
    expect(screen.getByLabelText('采购单 ID Purchase Order')).toHaveValue(21);
    expect(screen.getByLabelText('发货批次 ID Shipment Batch')).toHaveValue(101);
    expect(screen.getByLabelText('售后类型 Type')).toBeInTheDocument();
    expect(screen.getByLabelText('问题描述 Issue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建售后单' })).toBeInTheDocument();
  });

  it('blocks sales users from directly opening the formal after-sales create page', async () => {
    render(
      <>
        {await AppNewFormalAfterSalesPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
            salesOrderId: '88',
            purchaseOrderId: '21',
            shipmentBatchId: '101',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式新建售后单' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '无权限创建正式售后单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('button', { name: '创建售后单' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('问题描述 Issue')).not.toBeInTheDocument();
  });

  it('normalizes the formal after-sales payload and redirects to the formal detail page', async () => {
    const formData = new FormData();
    formData.set('salesOrderId', '9');
    formData.set('purchaseOrderId', '21');
    formData.set('shipmentBatchId', '3');
    formData.set('customerName', 'Acme Trading');
    formData.set('supplierName', 'Bravo Industrial');
    formData.set('type', 'customer_complaint');
    formData.set('issueDescription', 'Customer reported packaging damage');
    formData.set('createdBy', '2002');
    formData.set('role', 'purchase');
    formData.set('user', 'Leo');

    await expect(buildCreateFormalAfterSalesPayload(formData)).resolves.toEqual({
      salesOrderId: 9,
      purchaseOrderId: 21,
      shipmentBatchId: 3,
      customerName: 'Acme Trading',
      supplierName: 'Bravo Industrial',
      type: 'customer_complaint',
      issueDescription: 'Customer reported packaging damage',
      createdBy: 2002,
      role: 'purchase',
      user: 'Leo',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 401, afterSalesNo: 'AS202607110401' }),
      }),
    );

    await expect(
      createFormalAfterSalesAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/after-sales/401?role=purchase&user=Leo;303;`,
    });
  });

  it('posts formal after-sales creation with dynamic action scopes from the form access payload', async () => {
    const formData = new FormData();
    formData.set('salesOrderId', '9');
    formData.set('purchaseOrderId', '21');
    formData.set('shipmentBatchId', '3');
    formData.set('customerName', 'Acme Trading');
    formData.set('supplierName', 'Bravo Industrial');
    formData.set('type', 'customer_complaint');
    formData.set('issueDescription', 'Customer reported packaging damage');
    formData.set('createdBy', '2002');
    formData.set('role', 'purchase');
    formData.set('user', 'Leo');
    formData.set(
      'access',
      encodeURIComponent(
        JSON.stringify({
          actions: ['after_sales.process'],
        }),
      ),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 402, afterSalesNo: 'AS202607110402' }),
      }),
    );

    await expect(
      createFormalAfterSalesAction({ error: null }, formData),
    ).rejects.toMatchObject({
      digest: `${REDIRECT_ERROR_CODE};${RedirectType.push};/app/after-sales/402?role=purchase&user=Leo;303;`,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/after-sales',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-erp-role': 'purchase',
          'x-erp-user': 'Leo',
          'x-erp-actions': 'after_sales.process',
        }),
      }),
    );
  });
});
