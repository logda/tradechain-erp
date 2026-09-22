import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AppAfterSalesPage from '../app/app/after-sales/page';
import AppPurchaseOrdersPage from '../app/app/purchase-orders/page';
import AppShipmentBatchesPage from '../app/app/shipment-batches/page';

describe('formal operations pages', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the formal purchase order list page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              moduleLabel: '采购单',
              docNo: 'P202607110100',
              title: 'Acme 风扇供应拆单',
              status: 'draft',
              secondaryStatus: 'draft',
              supplierName: 'Acme Supply',
              ownerName: 'Leo',
              createdAt: '2026-07-11T09:00:00.000Z',
              detailHref: '/purchase-orders/100',
              createdBy: 'Zoe',
              approvalStatus: 'draft',
              fulfillmentStatus: 'not_started',
              salesOrderNo: 'S202607080001',
              isResubmitted: false,
            },
          ],
          page: 1,
          pageSize: 20,
          total: 25,
          appliedFilters: {
            keyword: null,
            docNo: null,
            status: null,
            dateFrom: null,
            dateTo: null,
            supplierName: null,
            createdBy: null,
            ownerName: null,
            approvalStatus: null,
            fulfillmentStatus: null,
            salesOrderNo: null,
            isResubmitted: 'all',
          },
        }),
      }),
    );

    render(
      <>{await AppPurchaseOrdersPage({ searchParams: Promise.resolve({}) })}</>,
    );

    expect(screen.getByRole('heading', { name: '正式采购单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(
      screen.getByRole('link', { name: '采购转单页' }),
    ).toHaveAttribute('href', '/app/purchase-orders/new');
    expect(screen.getByText('当前筛选')).toBeInTheDocument();
    expect(screen.getByText('查询结果')).toBeInTheDocument();
    expect(screen.getByText('P202607110100')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '追溯销售单 S202607080001' }),
    ).toHaveAttribute('href', '/app/sales/orders?docNo=S202607080001');
    expect(
      screen.getByRole('link', { name: '查看详情 P202607110100' }),
    ).toHaveAttribute('href', '/app/purchase-orders/100');
    expect(
      screen.getByRole('navigation', { name: '采购单分页' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute(
      'href',
      '/app/purchase-orders?page=2&pageSize=20',
    );
    expect(screen.getByRole('link', { name: '50' })).toHaveAttribute(
      'href',
      '/app/purchase-orders?page=1&pageSize=50',
    );
  });

  it('preserves purchase approval and fulfillment drilldown filters', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
          appliedFilters: {
            keyword: null,
            docNo: null,
            status: null,
            dateFrom: null,
            dateTo: null,
            supplierName: null,
            createdBy: null,
            ownerName: null,
            approvalStatus: 'pending_purchase_manager_approval',
            fulfillmentStatus: 'purchasing',
            salesOrderNo: null,
            isResubmitted: 'all',
          },
        }),
      }),
    );

    render(
      <>
        {await AppPurchaseOrdersPage({
          searchParams: Promise.resolve({
            approvalStatus: 'pending_purchase_manager_approval',
            fulfillmentStatus: 'purchasing',
          }),
        })}
      </>,
    );

    expect(screen.getByLabelText('审批状态 Approval Status')).toHaveValue(
      'pending_purchase_manager_approval',
    );
    expect(screen.getByLabelText('履约状态 Fulfillment Status')).toHaveValue(
      'purchasing',
    );
    expect(
      screen.getByText('approvalStatus: pending_purchase_manager_approval'),
    ).toBeInTheDocument();
    expect(screen.getByText('fulfillmentStatus: purchasing')).toBeInTheDocument();
  });

  it('renders the formal shipment batch list page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              moduleLabel: '发货批次',
              docNo: 'SH202607110100',
              title: 'Acme 风扇首批发货',
              status: 'shipped',
              secondaryStatus: 'shipped',
              supplierName: 'Acme Supply',
              salesOrderNo: 'S202607080001',
              purchaseOrderNo: 'P202607110100',
              receiptSendStatus: 'pending',
              hasException: false,
              createdAt: '2026-07-11T10:00:00.000Z',
              detailHref: '/shipment-batches/100',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 25,
          appliedFilters: {
            keyword: null,
            docNo: null,
            status: null,
            dateFrom: null,
            dateTo: null,
            supplierName: null,
            salesOrderNo: null,
            purchaseOrderNo: null,
            receiptSendStatus: null,
            hasException: 'all',
          },
        }),
      }),
    );

    render(
      <>{await AppShipmentBatchesPage({ searchParams: Promise.resolve({}) })}</>,
    );

    expect(screen.getByRole('heading', { name: '正式发货批次' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(screen.getByRole('link', { name: '新建发货批次' })).toHaveAttribute(
      'href',
      '/app/shipment-batches/new',
    );
    expect(screen.getByText('当前筛选')).toBeInTheDocument();
    expect(screen.getByText('查询结果')).toBeInTheDocument();
    expect(screen.getByText('SH202607110100')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '追溯销售单 S202607080001' }),
    ).toHaveAttribute('href', '/app/sales/orders?docNo=S202607080001');
    expect(
      screen.getByRole('link', { name: '追溯采购单 P202607110100' }),
    ).toHaveAttribute('href', '/app/purchase-orders?docNo=P202607110100');
    expect(
      screen.getByRole('link', { name: '查看详情 SH202607110100' }),
    ).toHaveAttribute('href', '/app/shipment-batches/100');
    expect(
      screen.getByRole('navigation', { name: '发货批次分页' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute(
      'href',
      '/app/shipment-batches?page=2&pageSize=20',
    );
    expect(screen.getByRole('link', { name: '50' })).toHaveAttribute(
      'href',
      '/app/shipment-batches?page=1&pageSize=50',
    );
  });

  it('renders shipment batches as a read-only sales submodule', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              moduleLabel: '发货批次',
              docNo: 'SH202607110101',
              title: 'Acme 风扇销售可见发货',
              status: 'shipped',
              secondaryStatus: 'shipped',
              supplierName: 'Acme Supply',
              salesOrderNo: 'S202607080001',
              purchaseOrderNo: 'P202607110101',
              goodsName: '测试风扇',
              customerName: 'Acme Trading',
              freightStation: '上海货运站',
              arrivalStatus: '已发',
              receiptSendStatus: 'pending',
              hasException: false,
              createdAt: '2026-07-11T10:00:00.000Z',
              detailHref: '/shipment-batches/101',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 25,
          appliedFilters: {
            hasException: 'all',
          },
        }),
      }),
    );

    render(
      <>
        {await AppShipmentBatchesPage({
          searchParams: Promise.resolve({ role: 'sales', user: 'Zoe' }),
        })}
      </>,
    );

    expect(screen.getByRole('heading', { name: '正式发货批次' })).toBeInTheDocument();
    expect(screen.getByText('SH202607110101')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '新建发货批次' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '追溯销售单 S202607080001' }),
    ).toHaveAttribute('href', '/app/sales/orders?docNo=S202607080001');
    expect(
      screen.queryByRole('link', { name: '追溯采购单 P202607110101' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '查看详情 SH202607110101' }),
    ).toHaveAttribute('href', '/app/shipment-batches/101');
  });

  it('renders the formal after-sales list page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              moduleLabel: '售后单',
              docNo: 'AS202607110100',
              title: 'Acme 风扇批次客诉',
              status: 'pending_submit',
              secondaryStatus: 'customer_complaint',
              createdAt: '2026-07-11T12:00:00.000Z',
              detailHref: '/after-sales/100',
              customerName: 'Acme Trading',
              supplierName: 'Acme Supply',
              createdBy: 'Leo',
              ownerName: 'Leo',
              type: 'customer_complaint',
              financeReviewStatus: 'pending',
              receiptCollectionStatus: 'unpaid',
              shipmentBatchNo: 'SH202607110100',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 25,
          appliedFilters: {
            keyword: null,
            docNo: null,
            status: null,
            dateFrom: null,
            dateTo: null,
            customerName: null,
            supplierName: null,
            createdBy: null,
            ownerName: null,
            type: null,
            financeReviewStatus: null,
            receiptCollectionStatus: null,
            shipmentBatchNo: null,
          },
        }),
      }),
    );

    render(<>{await AppAfterSalesPage({ searchParams: Promise.resolve({}) })}</>);

    expect(screen.getByRole('heading', { name: '正式售后单' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回正式首页' })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(screen.getByRole('link', { name: '新建售后单' })).toHaveAttribute(
      'href',
      '/app/after-sales/new',
    );
    expect(screen.getByText('当前筛选')).toBeInTheDocument();
    expect(screen.getByText('查询结果')).toBeInTheDocument();
    expect(screen.getByText('AS202607110100')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '追溯发货批次 SH202607110100' }),
    ).toHaveAttribute('href', '/app/shipment-batches?docNo=SH202607110100');
    expect(
      screen.getByRole('link', { name: '查看详情 AS202607110100' }),
    ).toHaveAttribute('href', '/app/after-sales/100');
    expect(
      screen.getByRole('navigation', { name: '售后单分页' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute(
      'href',
      '/app/after-sales?page=2&pageSize=20',
    );
    expect(screen.getByRole('link', { name: '50' })).toHaveAttribute(
      'href',
      '/app/after-sales?page=1&pageSize=50',
    );
  });
});
