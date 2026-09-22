import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SalesOrderDetailPage from '../app/sales-orders/[id]/page';

describe('SalesOrderDetailPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the sales order landing summary when loading succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'draft',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'purchasing',
          shipmentAggregateStatus: 'purchasing',
          stockOutStatus: 'not_started',
          stockOutDocNo: null,
          cancelReason: '客户取消订单',
          autoVoidedPurchaseOrderIds: [3001, 3002],
          items: [
            {
              lineNo: 1,
              sourceQuoteLineNo: 2,
              productId: 501,
              sku: 'SKU-LED-001',
              productName: '智能 LED 灯带',
              unit: 'set',
              quantity: 500,
              salePrice: 15.9,
              amount: 7950,
            },
          ],
          versionHistory: [
            {
              versionNo: 1,
              status: 'draft',
              createdAt: '2026-07-11T09:00:00.000Z',
            },
          ],
        }),
      }),
    );

    render(
      <>
        {await SalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
        })}
      </>,
    );

    expect(
      screen.getByRole('heading', { name: '销售订单 S202607080001' }),
    ).toBeInTheDocument();
    expect(screen.getByText('状态：draft')).toBeInTheDocument();
    expect(screen.getByText('采购汇总：purchasing')).toBeInTheDocument();
    expect(screen.getByText('发货汇总：purchasing')).toBeInTheDocument();
    expect(screen.getByText('出库汇总：not_started')).toBeInTheDocument();
    expect(screen.getByText('出库单号：未生成')).toBeInTheDocument();
    expect(screen.getByText('作废原因：客户取消订单')).toBeInTheDocument();
    expect(screen.getByText('联动作废采购单：3001, 3002')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '版本时间线' })).toBeInTheDocument();
    expect(screen.getByText('V1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '来源追溯' })).toBeInTheDocument();
    expect(screen.getByText('来源类型：直建销售单')).toBeInTheDocument();
    expect(screen.getByText('该销售单由销售直接创建，未关联需求单或报价单。')).toBeInTheDocument();
    expect(screen.queryByText('来源行 Source Line')).not.toBeInTheDocument();
  });

  it('renders close action after forwarder handoff even when finance is pending', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 101,
          salesNo: 'S202607080001',
          status: 'purchasing',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'forwarder_shipped',
          shipmentAggregateStatus: 'forwarder_shipped',
          receiptStatus: 'fully_paid',
          financeStatus: 'pending',
          receiptSendStatus: 'sent',
          afterSalesEndStatus: 'closed',
          versionHistory: [
            {
              versionNo: 1,
              status: 'draft',
              createdAt: '2026-07-11T09:00:00.000Z',
            },
            {
              versionNo: 2,
              status: 'pending_sales_manager_approval',
              createdAt: '2026-07-11T10:15:00.000Z',
              changeReason: '客户要求调整包装',
            },
          ],
        }),
      }),
    );

    render(
      <>
        {await SalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
        })}
      </>,
    );

    expect(screen.getByText('回款状态：fully_paid')).toBeInTheDocument();
    expect(screen.getByText('财务状态：pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更新回款状态' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '财务确认' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关单' })).toBeInTheDocument();
    expect(screen.getByText('客户要求调整包装')).toBeInTheDocument();
  });

  it('renders close action when finance is already confirmed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 102,
          salesNo: 'S202607080002',
          status: 'purchasing',
          currentVersionNo: 1,
          purchaseAggregateStatus: 'forwarder_shipped',
          shipmentAggregateStatus: 'forwarder_shipped',
          receiptStatus: 'fully_paid',
          financeStatus: 'confirmed',
          receiptSendStatus: 'sent',
          afterSalesEndStatus: 'closed',
        }),
      }),
    );

    render(
      <>
        {await SalesOrderDetailPage({
          params: Promise.resolve({ id: '102' }),
        })}
      </>,
    );

    expect(screen.getByRole('button', { name: '更新回款状态' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '财务确认' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关单' })).toBeInTheDocument();
  });

  it('renders a fallback state and sales-orders link when loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          message: 'sales order missing',
        }),
      }),
    );

    render(
      <>
        {await SalesOrderDetailPage({
          params: Promise.resolve({ id: '101' }),
        })}
      </>,
    );

    expect(screen.getByText('销售订单详情加载失败')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回销售订单列表' })).toHaveAttribute(
      'href',
      '/sales-orders',
    );
  });
});
