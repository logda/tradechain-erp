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

describe('销售列表业务摘要', () => {
  it('prioritizes products, document amount, stage and owner while showing one number, customer and source badge', async () => {
    await show();
    expect(screen.getByRole('heading', { name: '销售单' })).toBeInTheDocument();
    const row = screen.getByRole('link', { name: '查看详情 S-LAYOUT-1' }).closest('tr')!;
    expect(row.textContent?.match(/S-LAYOUT-1/g)).toHaveLength(1);
    expect(row.textContent?.match(/客户甲/g)).toHaveLength(1);
    expect(row).not.toHaveTextContent(base.title);
    expect(within(row).getByTitle(base.title)).toBeInTheDocument();
    expect(row).toHaveTextContent('灯带、控制器');
    expect(row).toHaveTextContent('123.45');
    expect(row).toHaveTextContent('pending_sales_manager_approval / 待销售主管审批');
    expect(row).toHaveTextContent('业务员');
    expect(row).toHaveTextContent('上海门店');
    expect(row).not.toHaveTextContent('QUOTE / 报价转单');
    expect(within(row).getByText('报价转入')).toBeInTheDocument();
    expect(within(row).queryByRole('link', { name: /按来源方式筛选/ })).not.toBeInTheDocument();
    const columns = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(columns.indexOf('产品')).toBeLessThan(columns.indexOf('单据金额'));
    expect(columns.indexOf('单据金额')).toBeLessThan(columns.indexOf('销售单状态 Status'));
    expect(columns.indexOf('销售单状态 Status')).toBeLessThan(columns.indexOf('负责人'));
    expect(screen.getByRole('combobox', { name: '来源方式 Source Mode' })).toBeInTheDocument();
    expect(within(screen.getByRole('combobox', { name: '状态 Status' })).getByRole('option', { name: 'pending_sales_manager_approval / 待销售主管审批' })).toHaveValue('pending_sales_manager_approval');
  });

  it('keeps unknown legacy amount as a dash, an explicit zero as zero and a distinct customer order number visible', async () => {
    await show([{ ...base, productNames: undefined, amount: undefined, customerOrderNo: '客户采购号77' },
      { ...base, docNo: 'S-LAYOUT-2', title: '客户甲', detailHref: '/sales-orders/2', amount: 0 }]);
    const first = screen.getByRole('link', { name: '查看详情 S-LAYOUT-1' }).closest('tr')!;
    const second = screen.getByRole('link', { name: '查看详情 S-LAYOUT-2' }).closest('tr')!;
    const amountIndex = screen.getAllByRole('columnheader').findIndex((cell) => cell.textContent === '单据金额');
    expect(within(first).getAllByRole('cell')[amountIndex]).toHaveTextContent('-');
    expect(within(second).getAllByRole('cell')[amountIndex]).toHaveTextContent('0');
    expect(first).toHaveTextContent('客户采购号77');
    expect(second.textContent?.match(/客户甲/g)).toHaveLength(1);
  });
});
