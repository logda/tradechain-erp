import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPurchaseSplitDraft } from '../app/app/_lib/purchase-split-draft';

describe('formal purchase order create page', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('splits a sales order into product-based purchase draft items', () => {
    expect(
      buildPurchaseSplitDraft({
        id: 101,
        salesNo: 'S202607080101',
        items: [
          {
            lineNo: 1,
            sku: 'SKU-LED-001',
            productName: '智能 LED 灯带',
            unit: 'set',
            quantity: 10,
            packageQuantity: 2,
            unitsPerPackage: 5,
            totalQuantity: 10,
            salePrice: 15.9,
            amount: 159,
            factoryPicUrls: [
              'http://127.0.0.1:3001/uploads/quote-led.png',
            ],
          },
          {
            lineNo: 2,
            sku: 'SKU-CBL-002',
            productName: 'USB-C 线缆',
            unit: 'pcs',
            quantity: 6,
            salePrice: 20,
            amount: 120,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        salesItemId: 1,
        supplierId: 0,
        productId: 0,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        quantity: 10,
        packageQuantity: 2,
        unitsPerPackage: 5,
        unitPrice: 0,
        internalCode: '',
        imageUrls: [
          'http://127.0.0.1:3001/uploads/quote-led.png',
        ],
      }),
      expect.objectContaining({
        salesItemId: 2,
        supplierId: 0,
        productId: 0,
        sku: 'SKU-CBL-002',
        productName: 'USB-C 线缆',
        unit: 'pcs',
        quantity: 6,
        unitPrice: 0,
      }),
    ]);
  });

  it('keeps unknown sales products without a default supplier', () => {
    expect(
      buildPurchaseSplitDraft({
        id: 102,
        salesNo: 'S202607080102',
        items: [
          {
            lineNo: 1,
            sku: 'SKU-UNKNOWN-001',
            productName: '未配置供应商商品',
            unit: 'pcs',
            quantity: 8,
            salePrice: 30,
            amount: 240,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        salesItemId: 1,
        supplierId: 0,
        productId: 0,
        sku: 'SKU-UNKNOWN-001',
        productName: '未配置供应商商品',
        unitPrice: 0,
      }),
    ]);
  });

  it('renders the formal purchase transfer page with a loaded sales order and create action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080101',
          status: 'draft',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'not_started',
          shipmentAggregateStatus: 'not_started',
          customerOrderNo: 'PO-ACME-20260708',
          storeName: '02 Libuys',
          orderDate: '2026-07-08',
          estimatedDeliveryDate: '2026-08-08',
          shipTo: 'SH Boninoe',
          salesOrderAttachments: [
            {
              fileName: 'sales-spec.pdf',
              mimeType: 'application/pdf',
              size: 10,
              url: 'http://127.0.0.1:3001/uploads/sales-spec.pdf',
            },
          ],
          items: [
            {
              lineNo: 1,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 10,
              packageQuantity: 2,
              unitsPerPackage: 5,
              totalQuantity: 10,
              salePrice: 15.9,
              amount: 159,
              factoryPicUrls: [
                'http://127.0.0.1:3001/uploads/quote-led.png',
              ],
            },
          ],
        }),
      }),
    );

    const { default: AppNewPurchaseOrderPage } = await import(
      '../app/app/purchase-orders/new/page'
    );

    render(
      <>
        {await AppNewPurchaseOrderPage({
          searchParams: Promise.resolve({
            salesOrderId: '101',
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式转采购单' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '返回正式采购单列表' }),
    ).toHaveAttribute('href', '/app/purchase-orders');
    expect(screen.getByLabelText('销售单 ID Sales Order')).toHaveValue(101);
    expect(screen.getByRole('heading', { name: '销售单 S202607080101' })).toBeInTheDocument();
    expect(screen.getByText('采购拆单预览')).toBeInTheDocument();
    expect(screen.getAllByText('未配置供应商').length).toBeGreaterThan(0);
    expect(screen.getByText('待补采购价')).toBeInTheDocument();
    expect(screen.getByText('SH Boninoe')).toBeInTheDocument();
    expect(screen.getByLabelText(/采购负责人 Purchase Owner/)).toHaveValue('Leo');
    expect(screen.getByText('普通采购只能选择自己')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成采购单' })).toBeInTheDocument();
  });

  it('allows purchase generation while warning when any sales item has no configured supplier', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 102,
          salesNo: 'S202607080102',
          status: 'purchasing',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'not_started',
          shipmentAggregateStatus: 'not_started',
          items: [
            {
              lineNo: 1,
              sku: 'SKU-UNKNOWN-001',
              productName: '未配置供应商商品',
              unit: 'pcs',
              quantity: 8,
              salePrice: 30,
              amount: 240,
            },
          ],
        }),
      }),
    );

    const { default: AppNewPurchaseOrderPage } = await import(
      '../app/app/purchase-orders/new/page'
    );

    render(
      <>
        {await AppNewPurchaseOrderPage({
          searchParams: Promise.resolve({
            salesOrderId: '102',
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByText('未配置供应商')).toBeInTheDocument();
    expect(
      screen.getByText('有 1 行商品未配置供应商或采购价，可以先生成采购单；采购需在草稿或待采购认领状态补充后再提交审批。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成采购单' })).toBeInTheDocument();
  });

  it('blocks sales users from directly opening the formal purchase transfer page', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppNewPurchaseOrderPage } = await import(
      '../app/app/purchase-orders/new/page'
    );

    render(
      <>
        {await AppNewPurchaseOrderPage({
          searchParams: Promise.resolve({
            salesOrderId: '101',
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式转采购单' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '无权限创建正式采购单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute('href', '/app');
    expect(screen.queryByRole('button', { name: '生成采购单' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('销售单 ID Sales Order')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
