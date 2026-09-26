import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('formal operations detail pages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  const bossAccess = encodeURIComponent(
    JSON.stringify({
      modules: ['sales', 'purchase', 'operations', 'boss_dashboard'],
      dataScope: 'all',
      actions: [
        'sales.order.write',
        'sales.sample.approve',
        'purchase.order.approve',
        'after_sales.process',
        'boss.confirm',
        'finance.confirm',
      ],
    }),
  );

  const bossAccessWithoutAfterSalesProcess = encodeURIComponent(
    JSON.stringify({
      modules: ['sales', 'purchase', 'operations', 'boss_dashboard'],
      dataScope: 'all',
      actions: ['shipment.update', 'boss.confirm', 'finance.confirm'],
    }),
  );

  it('renders the formal purchase order detail page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/owner-options')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 2001,
                username: 'zoe',
                realName: 'Zoe',
                roleCode: 'purchase',
                status: 'active',
              },
              {
                id: 2002,
                username: 'leo',
                realName: 'Leo',
                roleCode: 'purchase',
                status: 'active',
              },
            ],
          });
        }

        if (url.includes('/shipment-batches?')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                {
                  moduleLabel: '发货批次',
                  docNo: 'SH202607110301',
                  title: 'P202607080101 发货批次',
                  status: 'shipped',
                  secondaryStatus: 'shipped',
                  supplierName: '星河供应',
                  ownerName: 'Leo',
                  salesOrderNo: 'S202607080001',
                  purchaseOrderNo: 'P202607080101',
                  receiptSendStatus: 'pending',
                  hasException: false,
                  createdAt: '2026-07-11T12:00:00.000Z',
                  detailHref: '/shipment-batches/301',
                  freightStation: '上海货运站',
                  warehouseEntryNo: 'WH-IN-001',
                },
              ],
              total: 1,
              page: 1,
              pageSize: 50,
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
          id: 101,
          purchaseNo: 'P202607080101',
          status: 'draft',
          currentVersionNo: 1,
          sourceSalesOrderId: 88,
          salesOrderNo: 'S202607080001',
          supplierName: 'Acme Supply',
          ownerName: 'Zoe',
          customerOrderNo: 'PO-ACME-20260708',
          storeName: '02 Libuys',
          orderDate: '2026-07-08',
          factoryEstimatedDeliveryDate: '2026-08-08',
          shipTo: 'SH Boninoe',
          purchaseOrderAttachments: [
            {
              fileName: 'sales-spec.pdf',
              mimeType: 'application/pdf',
              size: 10,
              url: 'http://127.0.0.1:3001/uploads/sales-spec.pdf',
            },
          ],
          currentBatchCount: 0,
          cancelReason: '供应商交期变化，采购单作废',
          versionHistory: [
            {
              versionNo: 1,
              status: 'draft',
              createdAt: '2026-07-11T10:00:00.000Z',
            },
          ],
          items: [
            {
              lineNo: 1,
              sourceSalesItemId: 1,
              supplierId: 3001,
              productId: 501,
              sku: 'SKU-LED-001',
              internalCode: '501',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              packageQuantity: 20,
              unitsPerPackage: 25,
              unitPrice: 12.5,
              amount: 6250,
              imageUrls: [
                'http://127.0.0.1:3001/uploads/quote-led.png',
              ],
              factoryEstimatedDeliveryDate: '2026-08-08',
              shipTo: 'SH Boninoe',
              domesticFreight: 120,
            },
          ],
          }),
        });
      }),
    );

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    const { container } = render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '正式采购单详情' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '返回正式采购单列表' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '返回对应销售单' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '采购单 P202607080101' }),
    ).toBeInTheDocument();
    expect(screen.getByText('星河供应')).toBeInTheDocument();
    expect(screen.getByText('采购负责人：Zoe')).toBeInTheDocument();
    expect(screen.queryByText('PO-ACME-20260708')).not.toBeInTheDocument();
    expect(screen.queryByText('02 Libuys')).not.toBeInTheDocument();
    expect(screen.getByText('上海货运站')).toBeInTheDocument();
    expect(screen.getByText('WH-IN-001')).toBeInTheDocument();
    expect(screen.getAllByText('2026-07-08').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-08-08').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SH Boninoe').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'sales-spec.pdf' })).toHaveAttribute(
      'href',
      'http://127.0.0.1:3001/uploads/sales-spec.pdf',
    );
    expect(
      screen.getByRole('button', { name: '提交采购审批' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '保存草稿' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/采购负责人 Purchase Owner \*/)).toHaveTextContent('Zoe');
    expect(
      screen.queryByRole('link', { name: '打开发货批次页' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '来源追溯' })).toBeInTheDocument();
    expect(screen.getByText('来源销售单：S202607080001 / #88')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看来源销售单' }),
    ).toHaveAttribute('href', '/app/sales/orders/88');
    expect(
      screen.getByText('来源销售单信息会保留在系统追溯字段中，采购明细仅展示采购执行需要识别的字段。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '关联发货单' })).toBeInTheDocument();
    expect(screen.getByText('SH202607110301')).toBeInTheDocument();
    expect(screen.getByText('状态：shipped / 已发货')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看发货单 SH202607110301' }),
    ).toHaveAttribute('href', '/app/shipment-batches/301');
    expect(screen.queryByText('销售行 Sales Line')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成发货批次' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成收货单' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '采购明细' })).toBeInTheDocument();
    expect(screen.getByText('SKU-LED-001')).toBeInTheDocument();
    expect(screen.getByText('501')).toBeInTheDocument();
    expect(screen.getByText('智能 LED 灯带')).toBeInTheDocument();
    expect(screen.getByAltText('智能 LED 灯带 图片 1')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3001/uploads/quote-led.png',
    );
    expect(screen.getByText('6250')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '版本时间线' })).toBeInTheDocument();

    const shipmentItemsInput = container.querySelector<HTMLInputElement>(
      'input[name="items"]',
    );
    expect(shipmentItemsInput).toBeNull();
  });

  it('lets the assigned buyer adjust factory ETA after approval before shipment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes('/shipment-batches?')) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [], total: 0 }) });
      }
      if (String(input).includes('/owner-options')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => ({
        id: 111, purchaseNo: 'C-111', status: 'purchasing', currentVersionNo: 1,
        sourceSalesOrderId: 88, salesOrderNo: 'S-88', supplierName: '星河供应',
        ownerName: 'Leo', currentBatchCount: 0,
        factoryEstimatedDeliveryDate: '2026-09-30', items: [],
      }) });
    }));
    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );
    render(await AppPurchaseOrderDetailPage({
      params: Promise.resolve({ id: '111' }),
      searchParams: Promise.resolve({ role: 'purchase', user: 'Leo' }),
    }));
    expect(screen.getByLabelText(/调整后工厂预计交货时间/)).toHaveValue('2026-09-30');
    expect(screen.getByRole('button', { name: '保存交期调整' })).toBeInTheDocument();
  });

  it('renders purchase order detail pages that only expose sourceSalesNo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/owner-options')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 2001,
                username: 'zoe',
                realName: 'Zoe',
                roleCode: 'purchase',
                status: 'active',
              },
            ],
          });
        }

        if (url.includes('/shipment-batches?')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [],
              total: 0,
              page: 1,
              pageSize: 50,
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 103,
            purchaseNo: 'P202607080103',
            status: 'draft',
            currentVersionNo: 2,
            sourceSalesNo: 'S202607080003',
            supplierName: 'Acme Supply',
            ownerName: 'Zoe',
            customerOrderNo: 'PO-ACME-20260708',
            storeName: '02 Libuys',
            orderDate: '2026-07-08',
            factoryEstimatedDeliveryDate: '2026-08-08',
            shipTo: 'SH Boninoe',
            purchaseOrderAttachments: [],
            cancelReason: '',
            versionHistory: [],
            items: [],
          }),
        });
      }),
    );

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '103' }),
          searchParams: Promise.resolve({
            role: 'admin',
            user: 'Admin',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式采购单详情' })).toBeInTheDocument();
    expect(screen.getByText('来源销售单：S202607080003')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '查看来源销售单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '打开发货批次页' }),
    ).not.toBeInTheDocument();
  });

  it('blocks sales users from opening purchase order detail pages', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(
      screen.getByText('无权限访问正式采购单'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '采购单 P202607080101' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders shipment batch detail as read-only for sales users', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 101,
        batchNo: 'SH202607080101',
        status: 'shipped',
        receiptSendStatus: 'pending',
        factoryShipDate: '2026-07-11',
        shippingCode: 'SHIP-SALES-001',
        goodsName: '测试风扇',
        customerName: 'Acme Trading',
        freightStation: '上海货运站',
        arrivalStatus: '已发',
        salesOrderId: 88,
        purchaseOrderId: 21,
        hasException: false,
        items: [],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppShipmentBatchDetailPage } = await import(
      '../app/app/shipment-batches/[id]/page'
    );

    render(
      <>
        {await AppShipmentBatchDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '发货批次 SH202607080101' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '打开销售单' }),
    ).toHaveAttribute('href', '/app/sales/orders/88');
    expect(screen.queryByRole('link', { name: '打开采购单' })).not.toBeInTheDocument();
    expect(screen.getByText('SHIP-SALES-001')).toBeInTheDocument();
    expect(screen.getByText('Acme Trading')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '提交货代' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成出库单' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('renders purchase approval actions when the order is pending approval', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 102,
          purchaseNo: 'P202607080102',
          status: 'pending_purchase_manager_approval',
          currentVersionNo: 1,
          sourceSalesOrderId: 88,
          salesOrderNo: 'S202607080001',
          currentBatchCount: 0,
          cancelReason: '供应商交期变化，采购单作废',
          versionHistory: [
            {
              versionNo: 1,
              status: 'draft',
              createdAt: '2026-07-11T10:00:00.000Z',
            },
            {
              versionNo: 2,
              status: 'pending_purchase_manager_approval',
              createdAt: '2026-07-11T10:45:00.000Z',
              changeReason: '采购条件变化，需要重新提交',
            },
          ],
          items: [
            {
              lineNo: 1,
              sourceSalesItemId: 1,
              supplierId: 3001,
              productId: 501,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              unitPrice: 12.5,
              amount: 6250,
            },
          ],
        }),
      }),
    );

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '102' }),
          searchParams: Promise.resolve({
            role: 'purchase_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(
      screen.queryByRole('button', { name: '提交采购审批' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通过采购审批' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '驳回采购审批' })).toBeInTheDocument();
    expect(screen.getByText('采购条件变化，需要重新提交')).toBeInTheDocument();
    expect(screen.getByText('供应商交期变化，采购单作废')).toBeInTheDocument();
  });

  it('renders claim submit action for sales-generated purchase orders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/owner-options')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 2002,
                username: 'leo',
                realName: 'Leo',
                roleCode: 'purchase',
                status: 'active',
              },
            ],
          });
        }

        if (url.includes('/formal-lookup/counterparties')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                {
                  id: 3002,
                  type: 'supplier',
                  code: 'SUP-BRAVO',
                  name: '测试供应商-001',
                  shortName: 'Test Supplier 001',
                  status: 'active',
                },
              ],
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
          id: 105,
          purchaseNo: 'P202607080105',
          status: 'pending_purchase_claim',
          currentVersionNo: 1,
          sourceSalesOrderId: 88,
          salesOrderNo: 'S202607080001',
          supplierId: 0,
          supplierName: '待补供应商',
          ownerName: 'Leo',
          currentBatchCount: 0,
          versionHistory: [
            {
              versionNo: 1,
              status: 'pending_purchase_claim',
              createdAt: '2026-07-11T10:00:00.000Z',
            },
          ],
          items: [
            {
              lineNo: 1,
              supplierId: 0,
              productId: 0,
              sku: 'SKU-NO-MASTER-001',
              productName: '无主数据商品',
              unit: 'pcs',
              quantity: 12,
              unitPrice: 0,
              amount: 0,
            },
          ],
          }),
        });
      }),
    );

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '105' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(
      screen.getAllByText('pending_purchase_claim / 待采购认领').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: '认领并提交采购审批' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '保存草稿' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/采购负责人 Purchase Owner \*/)).toHaveTextContent('Leo');
    expect(screen.getAllByText('待补供应商').length).toBeGreaterThan(0);
    expect(screen.getByRole('group', { name: '供应商录入方式 Supplier Mode' })).toBeInTheDocument();
    expect(screen.getByLabelText(/供应商 Supplier/)).toHaveValue('');
    expect(screen.queryByLabelText(/手动供应商名称 Manual Supplier/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '选择供应商' }));
    expect(screen.getByRole('dialog', { name: '选择供应商' })).toBeInTheDocument();
    expect(screen.getByText('测试供应商-001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    fireEvent.click(screen.getByRole('button', { name: '手工填写' }));
    expect(screen.queryByRole('button', { name: '选择供应商' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/手动供应商名称 Manual Supplier/)).toHaveValue('');
    expect(screen.getByText('待补采购价')).toBeInTheDocument();
    const purchasePriceInput = screen.getByLabelText(/第 1 行采购价 Unit Price/);
    expect(purchasePriceInput).toHaveValue(null);
    expect(purchasePriceInput).toBeRequired();
    expect(purchasePriceInput).toHaveAttribute('min', '0.01');
    expect(
      screen.queryByRole('button', { name: '生成发货批次' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成收货单' }),
    ).not.toBeInTheDocument();
  });

  it('submits purchase detail actions with dynamic action scopes from server search params', async () => {
    window.history.replaceState({}, '', '/app/purchase-orders/101');
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith('/submit')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'pending_purchase_manager_approval' }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 101,
          purchaseNo: 'P202607080101',
          title: 'S202607080001-智能 LED 灯带-Acme Supply',
          status: 'draft',
          currentVersionNo: 1,
          sourceSalesOrderId: 88,
          salesOrderNo: 'S202607080001',
          supplierName: 'Acme Supply',
          ownerName: 'Leo',
          currentBatchCount: 0,
          items: [],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
            access: encodeURIComponent(
              JSON.stringify({
                modules: ['purchase'],
                dataScope: 'own_purchase',
                actions: ['purchase.order.submit'],
              }),
            ),
          }),
        })}
      </>,
    );

    expect(
      screen.queryByRole('link', { name: '返回对应销售单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '查看来源销售单' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '提交采购审批' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/purchase-orders/101/submit',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-erp-role': 'purchase',
            'x-erp-user': 'Leo',
            'x-erp-actions': 'purchase.order.submit',
          }),
        }),
      );
    });
  });

  it('hides purchase approval actions from purchase users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 102,
          purchaseNo: 'P202607080102',
          status: 'pending_purchase_manager_approval',
          currentVersionNo: 1,
          sourceSalesOrderId: 88,
          salesOrderNo: 'S202607080001',
          ownerName: 'Leo',
          currentBatchCount: 0,
          items: [],
        }),
      }),
    );

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '102' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(
      screen.queryByRole('button', { name: '提交采购审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('当前角色动作权限：可提交采购审批；通过/驳回需采购主管、老板或管理员。'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '通过采购审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '驳回采购审批' }),
    ).not.toBeInTheDocument();
  });

  it('hides purchase submit and shipment creation actions from boss users without execute scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 104,
          purchaseNo: 'P202607080104',
          status: 'draft',
          currentVersionNo: 1,
          sourceSalesOrderId: 88,
          salesOrderNo: 'S202607080001',
          ownerName: 'Leo',
          currentBatchCount: 0,
          items: [],
        }),
      }),
    );

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '104' }),
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
            access: bossAccess,
          }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '采购单 P202607080104' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '打开发货批次页' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '提交采购审批' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成发货批次' }),
    ).not.toBeInTheDocument();
  });

  it('renders only resubmit and shipment creation actions when the order is purchasing', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/shipment-batches')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 301, batchNo: 'SH202607110301', status: 'partial_shipped' }),
        });
      }
      if (url.includes('/shipment-batches?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [],
            total: 0,
            page: 1,
            pageSize: 50,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 103,
          purchaseNo: 'P202607080103',
          status: 'purchasing',
          currentVersionNo: 2,
          sourceSalesOrderId: 88,
          salesOrderNo: 'S202607080001',
          currentBatchCount: 0,
          items: [
            {
              lineNo: 1,
              sourceSalesItemId: 1,
              supplierId: 3001,
              productId: 501,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              unitPrice: 12.5,
              amount: 6250,
            },
          ],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    const { container } = render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '103' }),
          searchParams: Promise.resolve({
            role: 'purchase_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '重提采购审批' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '作废采购单' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '打开发货批次页' }),
    ).toHaveAttribute(
      'href',
      '/app/shipment-batches/new?salesOrderId=88&purchaseOrderId=103',
    );
    expect(
      screen.getByRole('button', { name: '生成发货批次' }),
    ).toBeInTheDocument();
    const shippingCodeInput = screen.getByLabelText('发货编码 1');
    const shippingCodeQtyInput = screen.getByLabelText('数量');
    const shippedQtyInput = screen.getByLabelText(/本次发货数量 Shipped Qty/);
    expect(shippingCodeInput).toBeRequired();
    expect(shippingCodeQtyInput).toHaveValue(500);
    expect(shippedQtyInput).toHaveValue('');
    fireEvent.change(shippingCodeInput, {
      target: { value: 'SHIP-TEST-001' },
    });
    fireEvent.change(shippingCodeQtyInput, {
      target: { value: '320' },
    });
    expect(shippedQtyInput).toHaveValue('320');
    fireEvent.click(screen.getByRole('button', { name: '生成发货批次' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:3001/api/shipment-batches',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"shippingCode":"SHIP-TEST-001"'),
        }),
      );
      const shipmentCall = fetchMock.mock.calls.find(
        ([input]) => String(input) === 'http://127.0.0.1:3001/api/shipment-batches',
      );
      expect(JSON.parse(String(shipmentCall?.[1]?.body))).toEqual(
        expect.objectContaining({
          shippedQty: 320,
          accumulatedQty: 320,
          remainingQty: 180,
          shippingCodeItems: [
            {
              code: 'SHIP-TEST-001',
              quantity: 320,
            },
          ],
          items: [
            expect.objectContaining({
              purchaseLineNo: 1,
              shippedQty: 320,
              purchaseQty: 500,
            }),
          ],
        }),
      );
    });
    expect(
      screen.queryByRole('button', { name: '生成收货单' }),
    ).not.toBeInTheDocument();

    const resubmitReasonInput = container.querySelector<HTMLInputElement>(
      'input[name="changeReason"]',
    );
    expect(resubmitReasonInput?.value).toBe('采购条件变化，需要重新提交');
  });

  it('allows another shipment batch when the purchase order is partially shipped', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/shipment-batches')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 302, batchNo: 'SH202607110302', status: 'shipped' }),
        });
      }
      if (url.includes('/shipment-batches?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              {
                moduleLabel: '发货批次',
                docNo: 'SH202607110301',
                title: 'P202607080103 第一批发货',
                status: 'shipped',
                secondaryStatus: 'shipped',
                supplierName: '星河供应',
                salesOrderNo: 'S202607080001',
                purchaseOrderNo: 'P202607080103',
                shippedQty: 320,
                remainingQty: 180,
                receiptSendStatus: 'pending',
                hasException: false,
                createdAt: '2026-07-11T12:00:00.000Z',
                detailHref: '/shipment-batches/301',
                items: [
                  {
                    purchaseLineNo: 1,
                    shippedQty: 320,
                    purchaseQty: 500,
                  },
                ],
              },
            ],
            total: 1,
            page: 1,
            pageSize: 50,
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 103,
          purchaseNo: 'P202607080103',
          status: 'partial_shipped',
          currentVersionNo: 2,
          sourceSalesOrderId: 88,
          salesOrderNo: 'S202607080001',
          currentBatchCount: 0,
          items: [
            {
              lineNo: 1,
              sourceSalesItemId: 1,
              supplierId: 3001,
              productId: 501,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              unitPrice: 12.5,
              amount: 6250,
            },
          ],
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppPurchaseOrderDetailPage } = await import(
      '../app/app/purchase-orders/[id]/page'
    );

    render(
      <>
        {await AppPurchaseOrderDetailPage({
          params: Promise.resolve({ id: '103' }),
          searchParams: Promise.resolve({
            role: 'purchase_manager',
            user: 'Mia',
          }),
        })}
      </>,
    );

    expect(screen.getByText('SH202607110301')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重提采购审批' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成发货批次' })).toBeInTheDocument();
    const shippingCodeInput = screen.getByLabelText('发货编码 1');
    const shippingCodeQtyInput = screen.getByLabelText('数量');
    const shippedQtyInput = screen.getByLabelText(/本次发货数量 Shipped Qty/);
    expect(shippingCodeQtyInput).toHaveValue(180);
    expect(shippedQtyInput).toHaveValue('');

    fireEvent.change(shippingCodeInput, {
      target: { value: 'SHIP-TEST-002' },
    });
    expect(shippedQtyInput).toHaveValue('180');
    fireEvent.click(screen.getByRole('button', { name: '生成发货批次' }));

    await waitFor(() => {
      const shipmentCall = fetchMock.mock.calls.find(
        ([input]) => String(input) === 'http://127.0.0.1:3001/api/shipment-batches',
      );
      expect(JSON.parse(String(shipmentCall?.[1]?.body))).toEqual(
        expect.objectContaining({
          purchaseOrderCurrentStatus: 'partial_shipped',
          currentBatchCount: 1,
          shippedQty: 180,
          accumulatedQty: 500,
          remainingQty: 0,
          shippingCodeItems: [
            {
              code: 'SHIP-TEST-002',
              quantity: 180,
            },
          ],
          items: [
            expect.objectContaining({
              purchaseLineNo: 1,
              shippedQty: 180,
              purchaseQty: 500,
            }),
          ],
        }),
      );
    });
  });

  it('renders the formal shipment batch detail page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          batchNo: 'SH202607080101',
          status: 'forwarder_shipped',
          receiptSendStatus: 'pending',
          factoryShipDate: '2026-07-11',
          shippingCode: 'SHIP-TEST-001',
          destination: '上海目的仓',
          shippingMark: 'MARK-001',
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
          salesOrderId: 88,
          purchaseOrderId: 21,
          receiptDocUrl: 'https://files.example.com/receipt-101.pdf',
          items: [
            {
              lineNo: 1,
              purchaseLineNo: 1,
              sourceSalesItemId: 1,
              productId: 501,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              shippedQty: 40,
              purchaseQty: 500,
            },
          ],
        }),
      }),
    );

    const { default: AppShipmentBatchDetailPage } = await import(
      '../app/app/shipment-batches/[id]/page'
    );

    const { container } = render(
      <>
        {await AppShipmentBatchDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '正式发货批次详情' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '返回正式发货批次列表' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '发货批次 SH202607080101' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '打开销售单' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '打开采购单' }),
    ).toHaveAttribute('href', '/app/purchase-orders/21');
    expect(screen.getByText('货代已发出')).toBeInTheDocument();
    expect(screen.getByText('待发送')).toBeInTheDocument();
    expect(screen.getByText('暂无异常标记')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '提交货代' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '打开售后单页' }),
    ).toHaveAttribute(
      'href',
      '/app/after-sales/new?salesOrderId=88&purchaseOrderId=21&shipmentBatchId=101',
    );
    expect(screen.getByRole('heading', { name: '链路追溯' })).toBeInTheDocument();
    expect(
      screen.getByText('销售单 #88 → 采购单 #21 → 发货批次 SH202607080101'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('售后入口会自动携带 salesOrderId、purchaseOrderId、shipmentBatchId，避免断链录入。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '发货台账字段' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '批次概览' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '货运站 Freight Station' })).toBeInTheDocument();
    expect(screen.getByText('SHIP-TEST-001')).toBeInTheDocument();
    expect(screen.getByText('上海目的仓')).toBeInTheDocument();
    expect(screen.getByText('星河供应')).toBeInTheDocument();
    expect(screen.getByText('上海货运站')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '货代已发运' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '确认到货' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '上传回单' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '发送回单' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '标记异常' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '生成售后单' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '生成出库单' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '发货明细' })).toBeInTheDocument();
    expect(screen.getByText('SKU-LED-001')).toBeInTheDocument();
    expect(screen.getAllByText('智能 LED 灯带').length).toBeGreaterThan(0);
    expect(
      screen.getByText('https://files.example.com/receipt-101.pdf'),
    ).toBeInTheDocument();

    const afterSalesForm = screen
      .getByRole('button', { name: '生成售后单' })
      .closest('form');
    expect(afterSalesForm).not.toBeNull();
    const afterSalesItemsInput = afterSalesForm?.querySelector<HTMLInputElement>(
      'input[name="items"]',
    );
    expect(JSON.parse(afterSalesItemsInput?.value ?? '[]')).toEqual([
      expect.objectContaining({
        shipmentLineNo: 1,
        purchaseLineNo: 1,
        sourceSalesItemId: 1,
        productId: 501,
        sku: 'SKU-LED-001',
        productName: '智能 LED 灯带',
        unit: 'set',
        affectedQty: 40,
        shipmentQty: 40,
      }),
    ]);

    const receiptInput = container.querySelector<HTMLInputElement>(
      'input[name="receiptDocUrl"]',
    );
    expect(receiptInput?.value).toBe(
      'https://files.example.com/receipt-101.pdf',
    );

    const stockOutForm = screen
      .getByRole('button', { name: '生成出库单' })
      .closest('form');
    expect(stockOutForm).not.toBeNull();
    expect(stockOutForm?.querySelector('input[name="sourceBizType"]')).toHaveValue(
      'shipment_batch',
    );
    expect(stockOutForm?.querySelector('input[name="sourceBizId"]')).toHaveValue('101');
    expect(stockOutForm?.querySelector('input[name="sourceDocNo"]')).toHaveValue(
      'SH202607080101',
    );
    expect(stockOutForm?.querySelector('input[name="warehouseId"]')).toHaveValue('1');
    expect(stockOutForm?.querySelector('input[name="locationId"]')).toHaveValue('11');
    expect(stockOutForm?.querySelector('input[name="createdBy"]')).toHaveValue('2002');
    expect(JSON.parse(stockOutForm?.querySelector('input[name="items"]')?.value ?? '[]')).toEqual([
      expect.objectContaining({
        productId: 501,
        quantity: 40,
      }),
    ]);
  });

  it('hides shipment update actions from boss users without shipment update scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 105,
          batchNo: 'SH202607080105',
          status: 'forwarder_shipped',
          receiptSendStatus: 'pending',
          salesOrderId: 88,
          purchaseOrderId: 21,
          items: [],
        }),
      }),
    );

    const { default: AppShipmentBatchDetailPage } = await import(
      '../app/app/shipment-batches/[id]/page'
    );

    render(
      <>
        {await AppShipmentBatchDetailPage({
          params: Promise.resolve({ id: '105' }),
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
            access: bossAccess,
          }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '发货批次 SH202607080105' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '确认到货' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '上传回单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '发送回单' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '标记异常' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '生成售后单' }),
    ).toBeInTheDocument();
  });

  it('hides after-sales creation entry from users without after-sales process scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 106,
          batchNo: 'SH202607080106',
          status: 'forwarder_shipped',
          receiptSendStatus: 'pending',
          salesOrderId: 88,
          purchaseOrderId: 21,
          items: [],
        }),
      }),
    );

    const { default: AppShipmentBatchDetailPage } = await import(
      '../app/app/shipment-batches/[id]/page'
    );

    render(
      <>
        {await AppShipmentBatchDetailPage({
          params: Promise.resolve({ id: '106' }),
          searchParams: Promise.resolve({
            role: 'boss',
            user: 'Mia',
            access: bossAccessWithoutAfterSalesProcess,
          }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '发货批次 SH202607080106' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '确认到货' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '打开售后单页' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '生成售后单' }),
    ).not.toBeInTheDocument();
  });

  it('renders the formal after-sales detail page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          afterSalesNo: 'AS202607080101',
          status: 'pending_submit',
          financeReviewStatus: 'pending',
          salesOrderId: 88,
          purchaseOrderId: 21,
          shipmentBatchId: 101,
          type: 'customer_complaint',
          issueDescription: 'Customer reported packaging damage',
          items: [
            {
              lineNo: 1,
              shipmentLineNo: 1,
              purchaseLineNo: 1,
              sourceSalesItemId: 1,
              productId: 501,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              affectedQty: 40,
              shipmentQty: 40,
            },
          ],
        }),
      }),
    );

    const { default: AppAfterSalesDetailPage } = await import(
      '../app/app/after-sales/[id]/page'
    );

    render(
      <>
        {await AppAfterSalesDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '正式售后单详情' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '返回正式售后单列表' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '售后单 AS202607080101' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '打开销售单' }),
    ).toHaveAttribute('href', '/app/sales/orders/88');
    expect(
      screen.getByRole('link', { name: '打开采购单' }),
    ).toHaveAttribute('href', '/app/purchase-orders/21');
    expect(
      screen.getByRole('link', { name: '打开发货批次' }),
    ).toHaveAttribute('href', '/app/shipment-batches/101');
    expect(screen.getByRole('heading', { name: '链路追溯' })).toBeInTheDocument();
    expect(screen.getByText('销售单 #88 → 采购单 #21 → 发货批次 #101')).toBeInTheDocument();
    expect(
      screen.getByText('来源销售、采购与发货信息会保留在系统追溯字段中，售后明细仅展示处理需要识别的字段。'),
    ).toBeInTheDocument();
    expect(screen.queryByText('来源销售行：1')).not.toBeInTheDocument();
    expect(screen.queryByText('销售行 Sales Line')).not.toBeInTheDocument();
    expect(screen.getByText('客户投诉')).toBeInTheDocument();
    expect(screen.getByText('Customer reported packaging damage')).toBeInTheDocument();
    expect(screen.getByText('当前状态：pending_submit / 待提交')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '提交售后审批' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '售后明细' })).toBeInTheDocument();
    expect(screen.getByText('SKU-LED-001')).toBeInTheDocument();
    expect(screen.getByText('智能 LED 灯带')).toBeInTheDocument();
    expect(screen.getAllByText('40')).toHaveLength(2);
  });

  it('blocks sales users from opening after-sales detail pages', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { default: AppAfterSalesDetailPage } = await import(
      '../app/app/after-sales/[id]/page'
    );

    render(
      <>
        {await AppAfterSalesDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(
      screen.getByText('无权限访问正式售后单'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '售后单 AS202607080101' }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hides after-sales finance confirmation from purchase users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          afterSalesNo: 'AS202607080101',
          status: 'finance_reviewing',
          financeReviewStatus: 'pending',
          salesOrderId: 88,
          purchaseOrderId: 21,
          shipmentBatchId: 101,
          type: 'customer_complaint',
          issueDescription: 'Customer reported packaging damage',
          items: [],
        }),
      }),
    );

    const { default: AppAfterSalesDetailPage } = await import(
      '../app/app/after-sales/[id]/page'
    );

    render(
      <>
        {await AppAfterSalesDetailPage({
          params: Promise.resolve({ id: '101' }),
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '处理完成' })).toBeInTheDocument();
    expect(
      screen.getByText('当前角色动作权限：可推进售后处理；财务确认需老板或管理员。'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '财务确认' }),
    ).not.toBeInTheDocument();
  });
});
