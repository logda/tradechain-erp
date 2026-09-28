import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../app/app/page';
import TodosPage from '../app/app/todos/page';
import SalesPage from '../app/app/sales/page';
import PurchasePage from '../app/app/purchase/page';
import OperationsPage from '../app/app/operations/page';
import ReportsPage from '../app/app/reports/page';
import BossPage from '../app/app/dashboard/boss/page';
import { getFormalTodos, type FormalTodoItem } from '../app/app/_lib/formal-todos';
import { loadFormalTodos } from '../app/app/_lib/load-formal-todos';

vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const todo = (domain: FormalTodoItem['domain']): FormalTodoItem => ({
  id: `real-${domain}`, docNo: `REAL-${domain}`, title: `真实${domain}任务`, domain,
  moduleLabel: '业务单据', statusLabel: '待处理', ownerName: '新员工',
  href: `/app/purchase-orders/104`, priority: 'high', description: '来自实时接口',
});
const live = { items: [todo('sales'), todo('purchase'), todo('operations'), todo('after_sales')], total: 4, count: 4, closedTotal: 2 };
const summary = {
  generatedAt: '2026-09-27T08:00:00.000Z', currency: 'CNY', scope: { dataScope: 'sales_team', timeRange: 'all_time' },
  totals: { salesOrderCount: 9, submittedAmount: 120, shippedAmount: 60, voidedAmount: 10 },
  afterSalesOverview: { openCases: 1 }, shipmentBreakdown: [], receiptBreakdown: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('真实工作台数据与请求状态', () => {
  it('keeps API-authorized team tasks despite different display names', () => {
    expect(getFormalTodos({ role: 'sales', user: '旧姓名', accessScopes: { modules: ['sales'], dataScope: 'sales_team' } }, [todo('sales')])).toHaveLength(1);
    expect(getFormalTodos({ role: 'boss', user: 'Mia' })).toEqual([]);
  });

  it.each([
    ['首页', HomePage],
    ['待办中心', TodosPage],
  ] as const)('%s shows API tasks and their document links', async (_, Page) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes('/reports/') ? summary : live })));
    render(<>{await Page({})}</>);
    for (const item of live.items) expect(screen.getByText(item.docNo)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: '打开单据' })[0]).toHaveAttribute('href', '/app/purchase-orders/104');
    expect(screen.getByText('消息待办 Todo: 04')).toBeInTheDocument();
    expect(screen.queryByText('Q202607080002')).not.toBeInTheDocument();
    expect(screen.queryByText('P202607080002')).not.toBeInTheDocument();
  });

  it.each([['销售', SalesPage], ['采购', PurchasePage], ['运营', OperationsPage]] as const)('%s business center keeps entries and sidebar count without task blocks', async (_, Page) => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes('/reports/') ? summary : live }));
    vi.stubGlobal('fetch', fetchMock);
    render(await Page({}));
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 04')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: '核心模块' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '打开单据' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-todo-block]')).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/todos/formal'))).toBe(false);
  });

  it.each([['首页', HomePage], ['待办中心', TodosPage], ['采购', PurchasePage], ['运营', OperationsPage]] as const)('%s failure has retry and no empty-success state', async (_, Page) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<>{await Page({})}</>);
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 暂不可用')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /重试/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/暂不可用/).length).toBeGreaterThan(0);
    expect(screen.queryByText('暂无待办')).not.toBeInTheDocument();
    expect(screen.queryByText('消息待办 Todo: 00')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '销售待办' })).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('sales summary failure leaves business entries and the independent sidebar count available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => ({ ok: !url.includes('/reports/'), json: async () => live })));
    render(<>{await SalesPage({})}</>);
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 04')).toBeInTheDocument());
    expect(screen.getByText(/销售统计暂不可用/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '销售单模块' })).toBeInTheDocument();
    expect(screen.queryByText('REAL-sales')).not.toBeInTheDocument();
    expect(screen.queryByText('销售单总数')).not.toBeInTheDocument();
    expect(screen.queryByText('未同步')).not.toBeInTheDocument();
  });

  it('sales summary keeps its own scope and timestamp after removing center tasks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes('/reports/') ? summary : { ...live, generatedAt: '2026-09-28T09:00:00.000Z' } })));
    render(<>{await SalesPage({})}</>);
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 04')).toBeInTheDocument());
    expect(screen.queryByRole('region', { name: '销售待办' })).not.toBeInTheDocument();
    expect(screen.getByText(new Date(summary.generatedAt).toLocaleString('zh-CN'))).toBeInTheDocument();
    expect(screen.queryByText(new Date('2026-09-28T09:00:00.000Z').toLocaleString('zh-CN'))).not.toBeInTheDocument();
    expect(screen.getAllByText(/数据范围：销售团队/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/统计时间：全部时间/).length).toBeGreaterThan(0);
  });

  it('reports show independent errors rather than zero profit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<>{await ReportsPage({})}</>);
    expect(screen.getByText(/毛利统计暂不可用/)).toBeInTheDocument();
    expect(screen.getByText(/期间统计暂不可用/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 暂不可用')).toBeInTheDocument());
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('boss dashboard failure does not invent zero orders or alerts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<>{await BossPage({})}</>);
    expect(screen.getByText(/经营看板暂不可用/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 暂不可用')).toBeInTheDocument());
    expect(screen.queryByText('销售总单')).not.toBeInTheDocument();
    expect(screen.queryByText(/待审批销售单：0/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /重试/ }).length).toBeGreaterThan(0);
  });

  it('rejects a dashboard with missing metrics instead of filling them with zeros', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      generatedAt: summary.generatedAt, workflowAlerts: [], salesOverview: { totalOrders: 4 },
      purchaseOverview: { totalOrders: 2 }, afterSalesOverview: { openCases: 1 }, financeOverview: { pendingConfirmation: 1 },
    }) }));
    render(<>{await BossPage({})}</>);
    expect(screen.getByText(/经营看板暂不可用/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 暂不可用')).toBeInTheDocument());
  });

  it('treats malformed task records as a failed load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [null], total: 1, closedTotal: 0 }) }));
    expect(await loadFormalTodos({ role: 'boss', user: 'Mia' })).toBeNull();
  });

  it('a failed period report keeps the successful amount summary and its own timestamp', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => url.endsWith('/reports/gross-profit') ? { ok: true, json: async () => ({ generatedAt: summary.generatedAt, currency: 'CNY', totalRevenue: 500, totalProcurementCost: 377, totalAfterSalesCost: null, grossProfit: null, grossMargin: null, amountDifference: 123, calculationStatus: 'incomplete', missingCosts: ['after_sales', 'freight'], unknownCurrencyCount: 0, sourceDocuments: [] }) } : { ok: false }));
    render(<>{await ReportsPage({})}</>);
    expect(screen.getByText(/销售与采购单金额差额：123 CNY/)).toBeInTheDocument();
    expect(screen.queryByText('25.0%')).not.toBeInTheDocument();
    expect(screen.getByText(/期间统计暂不可用/)).toBeInTheDocument();
    expect(screen.getByText(new Date(summary.generatedAt).toLocaleString('zh-CN'))).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 暂不可用')).toBeInTheDocument());
  });
});
