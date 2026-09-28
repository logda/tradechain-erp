import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SalesOrdersPage from '../app/app/sales/orders/page';
import type { SalesOrderListItem } from '@erp/shared';

vi.mock('../app/app/_components/live-todo-count', () => ({ LiveTodoCount: () => null }));
const base = { moduleLabel: '销售单', docNo: 'S-LAYOUT-1', title: 'S-LAYOUT-1-灯带-客户甲',
  status: 'pending_sales_manager_approval', counterpartyName: '客户甲', customerOrderNo: 'S-LAYOUT-1',
  storeName: '上海门店', ownerName: '业务员', createdAt: '2026-09-28T00:00:00.000Z',
  detailHref: '/sales-orders/1', createdBy: '业务员', approvalStatus: 'pending_sales_manager_approval',
  fulfillmentStatus: 'not_started', receiptStatus: 'unpaid', financeConfirmStatus: 'pending', hasAfterSales: false,
  sourceSummary: 'QUOTE / 报价转单', productNames: ['灯带', '控制器'], amount: 123.45 };
afterEach(() => vi.unstubAllGlobals());
async function show(items: SalesOrderListItem[] = [base]) {
  vi.stubGlobal('fetch', vi.fn(async (input: unknown) => ({ ok: true,
    json: async () => String(input).includes('/audit-logs') ? { items: [] } : { items, total: items.length, page: 1, pageSize: 20 } })));
  render(await SalesOrdersPage({ searchParams: Promise.resolve({ role: 'boss', user: 'Mia' }) }));
}

describe('销售列表原有字段', () => {
  it('keeps the original eight columns, full title, customer order and source display', async () => {
    await show();
    expect(screen.getByRole('heading', { name: '销售单' })).toBeInTheDocument();
    const row = screen.getByRole('link', { name: '查看详情 S-LAYOUT-1' }).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(8);
    expect(cells[0]).toHaveTextContent(base.docNo);
    expect(within(cells[0]).getByText(base.title)).toBeInTheDocument();
    expect(cells[2]).toHaveTextContent(base.counterpartyName);
    expect(cells[3]).toHaveTextContent(`订单：${base.customerOrderNo}`);
    expect(cells[3]).toHaveTextContent(`门店：${base.storeName}`);
    expect(row).toHaveTextContent('pending_sales_manager_approval / 待销售主管审批');
    expect(row).toHaveTextContent('业务员');
    expect(row).toHaveTextContent('上海门店');
    expect(cells[5]).toHaveTextContent('QUOTE / 报价转单');
    expect(within(row).getByText('报价转入')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: '按来源方式筛选 报价转入' })).toHaveAttribute('href', '/app/sales/orders?sourceMode=from_quote');
    expect(cells[6]).toHaveTextContent('业务员');
    const columns = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(columns).toEqual(['销售单号 / 标题', '销售单状态 Status', '客户 Customer', '客户订单 / 门店',
      '订货日期 / 截止日期', '来源 Source', '负责人', '操作']);
    expect(screen.getByRole('combobox', { name: '来源方式 Source Mode' })).toBeInTheDocument();
    expect(within(screen.getByRole('combobox', { name: '状态 Status' })).getByRole('option', { name: 'pending_sales_manager_approval / 待销售主管审批' })).toHaveValue('pending_sales_manager_approval');
  });

  it('shows the login username in the original owner column without changing columns', async () => {
    await show([{ ...base, ownerName: '用户 #2000', userDisplayNames: { ownerName: 'mia' } } as SalesOrderListItem]);
    const row = screen.getByRole('link', { name: '查看详情 S-LAYOUT-1' }).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(8);
    expect(cells[6]).toHaveTextContent('mia');
    expect(row).not.toHaveTextContent('用户 #2000');
  });

  it('shows missing order, store and dates as dashes and retains distinct customer orders and titles', async () => {
    await show([{ ...base, customerOrderNo: undefined, storeName: undefined },
      { ...base, docNo: 'S-LAYOUT-2', title: '客户甲', detailHref: '/sales-orders/2', customerOrderNo: '客户采购号77' }]);
    const first = screen.getByRole('link', { name: '查看详情 S-LAYOUT-1' }).closest('tr')!;
    const second = screen.getByRole('link', { name: '查看详情 S-LAYOUT-2' }).closest('tr')!;
    const cells = within(first).getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('订单：-');
    expect(cells[3]).toHaveTextContent('门店：-');
    expect(cells[4]).toHaveTextContent('订货：-');
    expect(cells[4]).toHaveTextContent('截止：-');
    expect(second).toHaveTextContent('客户采购号77');
    expect(within(second).getAllByRole('cell')[0]).toHaveTextContent('客户甲');
    expect(screen.queryByRole('columnheader', { name: '产品', exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '单据金额', exact: true })).not.toBeInTheDocument();
  });
});
