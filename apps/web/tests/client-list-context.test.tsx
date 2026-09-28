import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceTabs } from '../app/app/_components/workspace-tabs';
import { FormalTodoCenter } from '../app/app/_components/formal-todo-center';
import type { FormalTodoItem } from '../app/app/_lib/formal-todos';
import { ProductMasterDataClient } from '../app/app/master-data/products/product-master-data-client';
import { defaultProductCodeRuleSet } from '../app/app/master-data/products/product-code-rule';
vi.mock('next/navigation', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/navigation')>(), usePathname: () => '/app/master-data/products',
}));

const todos: FormalTodoItem[] = Array.from({ length: 12 }, (_, index) => ({
  id: String(index), docNo: `S-${index}`, title: 'Acme销售任务', domain: 'sales', moduleLabel: '销售单',
  statusLabel: '待修改', ownerName: 'Admin', href: `/app/sales/orders/${index + 1}`,
  priority: 'high', description: '', relation: 'action',
}));
const product = (name = '初始商品', id = 1) => ({
  id, sku: `SKU-${id}`, nameCn: name, nameEn: name, category: 'electronics' as const,
  unit: 'pcs', currency: 'CNY', defaultSalePrice: 10, ownerName: 'Admin',
  status: 'active' as const, createdAt: '2026-09-28T00:00:00.000Z', createdBy: 'Admin',
});
function products({ userId = '1', initialQuery = { page: 1, pageSize: 20 }, hasExplicitQuery = false,
  initialItems = [product()] }: { userId?: string; initialQuery?: { page: number; pageSize: number; keyword?: string }; hasExplicitQuery?: boolean; initialItems?: ReturnType<typeof product>[] } = {}) {
  return <ProductMasterDataClient initialItems={initialItems} initialTotal={60} initialQuery={initialQuery}
    hasExplicitQuery={hasExplicitQuery} canManageMasterData={false} salesView updatedBy="Admin"
    codeRule={defaultProductCodeRuleSet.purchase} salesCodeRule={defaultProductCodeRuleSet.sales}
    supplierOptions={[]} requestHeaders={{ 'x-erp-user-id': userId, 'x-erp-role': 'admin', 'x-erp-data-scope': 'all' }} apiBaseUrl="/api" />;
}
function productFetch() {
  return vi.fn().mockImplementation(async (input: string) => {
    const params = new URL(input, 'http://localhost').searchParams;
    const page = Number(params.get('page'));
    const keyword = params.get('keyword') ?? '';
    return { ok: true, json: async () => ({ items: [product(`${keyword}商品${page}`, page + 100)], total: 60, page, pageSize: 20 }) };
  });
}

beforeEach(() => {
  sessionStorage.clear();
  history.replaceState({}, '', '/app/master-data/products');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('本地列表查询上下文', () => {
  it('restores applied todo filters, the group page, and a separate pending filter draft for the same employee', () => {
    const mounted = render(<FormalTodoCenter todos={todos} sessionKey="1:admin:all" />);
    fireEvent.change(screen.getByLabelText('关键词'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    const group = screen.getByRole('region', { name: '销售待办' });
    fireEvent.click(within(group).getByRole('button', { name: '下一页' }));
    fireEvent.change(screen.getByLabelText('关键词'), { target: { value: '尚未应用' } });
    mounted.unmount();
    const restored = render(<FormalTodoCenter todos={todos} sessionKey="1:admin:all" />);
    expect(screen.getByLabelText('关键词')).toHaveValue('尚未应用');
    expect(screen.getByText('查询结果：共 12 条')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '销售待办' })).getByText('第 2 / 3 页')).toBeInTheDocument();
    restored.unmount();
    render(<FormalTodoCenter todos={todos} sessionKey="2:admin:all" />);
    expect(screen.getByLabelText('关键词')).toHaveValue('');
    expect(within(screen.getByRole('region', { name: '销售待办' })).getByText('第 1 / 3 页')).toBeInTheDocument();
  });

  it('restores the last successful product query by refetching its page and keeps unapplied draft filters separate', async () => {
    const fetch = productFetch();
    vi.stubGlobal('fetch', fetch);
    const mounted = render(products());
    fireEvent.change(screen.getByLabelText('关键词 Keyword'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(screen.getAllByText('Acme商品1').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(screen.getAllByText('Acme商品2').length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText('关键词 Keyword'), { target: { value: '待应用' } });
    mounted.unmount();
    fetch.mockClear();
    render(products());
    await waitFor(() => expect(screen.getAllByText('Acme商品2').length).toBeGreaterThan(0));
    expect(fetch).toHaveBeenCalledWith('/api/products?keyword=Acme&page=2&pageSize=20', expect.anything());
    expect(screen.getByText('第 2 / 3 页，共 60 条')).toBeInTheDocument();
    expect(screen.getByLabelText('关键词 Keyword')).toHaveValue('待应用');
    expect(screen.queryByText('初始商品')).not.toBeInTheDocument();
  });

  it('respects a different explicit URL query instead of restoring the cached product query', async () => {
    const fetch = productFetch();
    vi.stubGlobal('fetch', fetch);
    const mounted = render(products());
    fireEvent.change(screen.getByLabelText('关键词 Keyword'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(screen.getAllByText('Acme商品1').length).toBeGreaterThan(0));
    mounted.unmount();
    fetch.mockClear();
    render(products({ initialQuery: { keyword: '显式', page: 1, pageSize: 20 }, hasExplicitQuery: true, initialItems: [product('显式商品')] }));
    expect(screen.getByLabelText('关键词 Keyword')).toHaveValue('显式');
    expect(screen.getAllByText('显式商品').length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps new draft edits made while the cached product page is loading', async () => {
    const fetch = productFetch();
    vi.stubGlobal('fetch', fetch);
    const mounted = render(products());
    fireEvent.change(screen.getByLabelText('关键词 Keyword'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(screen.getAllByText('Acme商品1').length).toBeGreaterThan(0));
    mounted.unmount();
    let finish!: (value: unknown) => void;
    fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(products());
    fireEvent.change(screen.getByLabelText('关键词 Keyword'), { target: { value: '新的待应用' } });
    finish({ ok: true, json: async () => ({ items: [product('Acme商品1', 101)], total: 60, page: 1, pageSize: 20 }) });
    await waitFor(() => expect(screen.getAllByText('Acme商品1').length).toBeGreaterThan(0));
    expect(screen.getByLabelText('关键词 Keyword')).toHaveValue('新的待应用');
  });

  it('restores list scroll again after the cached product page finishes fetching', async () => {
    const fetch = productFetch();
    vi.stubGlobal('fetch', fetch);
    const view = () => <><WorkspaceTabs title="产品库" sessionKey="1:admin" />{products()}</>;
    const mounted = render(view());
    fireEvent.change(screen.getByLabelText('关键词 Keyword'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(screen.getAllByText('Acme商品1').length).toBeGreaterThan(0));
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1200 });
    fireEvent.scroll(window);
    mounted.unmount();
    let finish!: (value: unknown) => void;
    fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(view());
    vi.mocked(window.scrollTo).mockClear();
    finish({ ok: true, json: async () => ({ items: [product('Acme商品1', 101)], total: 60, page: 1, pageSize: 20 }) });
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith({ top: 1200, left: 0, behavior: 'instant' }));
  });

  it('does not turn a failed product query into a saved result or share it with another employee', async () => {
    const fetch = productFetch();
    vi.stubGlobal('fetch', fetch);
    const mounted = render(products());
    fireEvent.change(screen.getByLabelText('关键词 Keyword'), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await waitFor(() => expect(screen.getAllByText('Acme商品1').length).toBeGreaterThan(0));
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });
    fireEvent.change(screen.getByLabelText('关键词 Keyword'), { target: { value: '失败查询' } });
    fireEvent.click(screen.getByRole('button', { name: '查询' }));
    await screen.findByText('商品列表加载失败');
    mounted.unmount();
    fetch.mockClear();
    const restored = render(products());
    await waitFor(() => expect(screen.getAllByText('Acme商品1').length).toBeGreaterThan(0));
    expect(fetch).toHaveBeenCalledWith('/api/products?keyword=Acme&page=1&pageSize=20', expect.anything());
    expect(screen.getByLabelText('关键词 Keyword')).toHaveValue('失败查询');
    restored.unmount();
    fetch.mockClear();
    render(products({ userId: '2' }));
    expect(screen.getByLabelText('关键词 Keyword')).toHaveValue('');
    expect(fetch).not.toHaveBeenCalled();
  });
});
