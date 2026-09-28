import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorktileCard } from '../app/app/_components/worktile-card';
import { FormalPagination } from '../app/app/_components/formal-pagination';
import { FilterPanel } from '../app/app/_components/filter-panel';
import { TodoGroup } from '../app/app/_components/todo-group';
import { AppShell } from '../app/app/_components/app-shell';
import { WorkspaceTabs } from '../app/app/_components/workspace-tabs';

vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(),
  usePathname: () => '/app/sales/orders/101', useRouter: () => ({ refresh: vi.fn() }),
}));
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false })); });
afterEach(() => vi.unstubAllGlobals());

describe('常用内容优先与去重', () => {
  it('uses one linked business heading without a developer badge or repeated title', () => {
    render(<WorktileCard title="销售单" href="/app/sales/orders" description="查看和处理销售单。" badge="Sales Order" />);
    expect(screen.getAllByText('销售单')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '销售单' })).toContainElement(screen.getByRole('link', { name: '销售单' }));
    expect(screen.queryByText('正式模块')).not.toBeInTheDocument();
    expect(screen.queryByText('Sales Order')).not.toBeInTheDocument();
  });
  it('hides page navigation for a single page while retaining the record count', () => {
    render(<FormalPagination pathname="/app/sales/orders" params={{ keyword: 'Acme' }} page={1} pageSize={20} total={3} summaryLabel="销售单" />);
    expect(screen.queryByRole('navigation', { name: '销售单分页' })).not.toBeInTheDocument();
    expect(screen.getByText(/共 3 条/)).toBeInTheDocument();
    expect(screen.queryByText('下一页')).not.toBeInTheDocument();
  });
  it('keeps a working filtered navigation when there are multiple pages', () => {
    render(<FormalPagination pathname="/app/sales/orders" params={{ keyword: 'Acme' }} page={1} pageSize={20} total={23} />);
    expect(screen.getByRole('link', { name: '下一页' })).toHaveAttribute('href', '/app/sales/orders?keyword=Acme&page=2&pageSize=20');
  });
  it('keeps selected server filters visible outside the collapsed panel with a clear link', async () => {
    render(<FilterPanel clearHref="/app/sales/orders"><form method="get"><label>关键词<input name="keyword" defaultValue="Acme" /></label><label>状态<select name="status" defaultValue="pending"><option value="">全部</option><option value="pending">待审批</option></select></label></form></FilterPanel>);
    await waitFor(() => expect(screen.getByText(/关键词：Acme/)).toBeInTheDocument());
    expect(screen.getByText(/状态：待审批/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '清除筛选' })).toHaveAttribute('href', '/app/sales/orders');
    expect(document.querySelector('details')).not.toHaveAttribute('open');
  });
  it('omits unselected checkboxes from applied server filters', async () => {
    render(<FilterPanel><form><label>只看有售后<input type="checkbox" name="hasAfterSales" value="yes" /></label></form></FilterPanel>);
    await waitFor(() => expect(screen.queryByText(/已选：/)).not.toBeInTheDocument());
  });
  it('uses applied client filters rather than pending input and clears through the existing handler', () => {
    const clear = vi.fn();
    render(<FilterPanel appliedSummary="关键词：已应用" onClear={clear}><form><input defaultValue="尚未应用" /></form></FilterPanel>);
    expect(screen.getByText(/关键词：已应用/)).toBeInTheDocument();
    expect(screen.queryByText(/关键词：尚未应用/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' })); expect(clear).toHaveBeenCalledOnce();
  });
  it('does not repeat the status in a task title and hides one-page controls and large no-image placeholders', () => {
    render(<TodoGroup title="销售待办" todos={[{ id: '1', domain: 'sales', title: '销售单待销售主管审批', statusLabel: '待销售主管审批', docNo: 'S-101', ownerName: '销售员', moduleLabel: '销售单', priority: 'high', description: '', href: '/app/sales/orders/101' }]} />);
    expect(screen.queryByRole('navigation', { name: '销售待办分页' })).not.toBeInTheDocument();
    expect(screen.queryByText('暂无图片')).not.toBeInTheDocument();
    expect(screen.getByText('S-101')).toBeInTheDocument();
    expect(screen.queryByText(/S-101 · 待销售主管审批/)).not.toBeInTheDocument();
  });
  it('uses a business document label for tabs without appending an internal id', () => {
    render(<WorkspaceTabs title="销售单详情" tabLabel="S-101 · Acme" sessionKey="1:admin" />);
    expect(screen.getByRole('tab', { name: 'S-101 · Acme' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /#101/ })).not.toBeInTheDocument();
  });
  it('groups authorized sidebar entries and removes developer wording', async () => {
    render(<AppShell title="首页" session={{ role: 'admin', user: 'Admin' }}><p>工作内容</p></AppShell>);
    await waitFor(() => expect(screen.queryByText('消息待办 Todo: 加载中…')).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '待办中心' })).toBeInTheDocument();
    expect(screen.getByText('业务')).toBeInTheDocument();
    expect(screen.getByText('资料与库存')).toBeInTheDocument();
    expect(screen.queryByText(/正式工作台入口/)).not.toBeInTheDocument();
  });
});
