import { Suspense } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FormalAppLayout from '../app/app/layout';
import Loading from '../app/app/loading';
import { AppShell } from '../app/app/_components/app-shell';

const request = vi.hoisted(() => ({ pathname: '/app/sales', token: 'valid-token' as string | undefined }));
vi.mock('next/navigation', () => ({ usePathname: () => request.pathname }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => request.token ? { value: request.token } : undefined }) }));

const session = {
  role: 'sales' as const, user: '张三', userId: 57, username: 'zhangsan',
  accessScopes: { modules: ['sales'], dataScope: 'own_sales', actions: [] },
};

function delayedPage(title: string) {
  let ready = false;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  function Page() {
    if (!ready) throw pending;
    return <AppShell title={title} session={session}><p>{title}的数据</p></AppShell>;
  }
  return {
    children: <Suspense fallback={<Loading />}><Page /></Suspense>,
    finish: async () => { ready = true; release(); await pending; },
  };
}

beforeEach(() => {
  request.pathname = '/app/sales';
  request.token = 'valid-token';
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => ({
    ok: true, json: async () => url.endsWith('/auth/session') ? session : { count: 0 },
  })));
});
afterEach(() => vi.unstubAllGlobals());

describe('正式页面内容区加载', () => {
  it('keeps the actual account and authorized navigation while the first page waits for data', async () => {
    const page = delayedPage('销售工作台');
    render(await FormalAppLayout({ children: page.children }));
    const sidebar = screen.getByRole('complementary');
    expect(within(sidebar).getByText('用户 User: zhangsan')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: '销售中心' })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('link', { name: '采购中心' })).not.toBeInTheDocument();
    expect(screen.getByRole('status').closest('.erp-shell__body')).toBeInTheDocument();
    expect(screen.queryByText('销售工作台的数据')).not.toBeInTheDocument();
    await act(page.finish);
    await waitFor(() => expect(screen.getByText('销售工作台的数据')).toBeInTheDocument());
    expect(screen.getByRole('complementary')).toBe(sidebar);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('retains the same sidebar and tabs during navigation without assigning the old title to the new page', async () => {
    const { rerender } = render(await FormalAppLayout({ children: <AppShell title="销售工作台" session={session}><p>原页面的数据</p></AppShell> }));
    const sidebar = screen.getByRole('complementary');
    const tabs = screen.getByRole('navigation', { name: '系统工作区页签' });
    expect(screen.getByRole('tab', { name: '销售工作台' })).toHaveAttribute('href', '/app/sales');

    request.pathname = '/app/sales/orders';
    const page = delayedPage('销售单');
    rerender(await FormalAppLayout({ children: page.children }));
    expect(screen.getByRole('complementary')).toBe(sidebar);
    expect(screen.getByRole('navigation', { name: '系统工作区页签' })).toBe(tabs);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('status').closest('.erp-shell__body')).toBeInTheDocument();
    await act(page.finish);
    await waitFor(() => expect(screen.getByRole('tab', { name: '销售单' })).toHaveAttribute('href', '/app/sales/orders'));
    expect(screen.getByRole('complementary')).toBe(sidebar);
    expect(screen.getByText('销售单的数据')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('leaves the signed-out login page without a default business account or sidebar', async () => {
    request.token = undefined;
    render(await FormalAppLayout({ children: <h1>ERP 登录</h1> }));
    expect(screen.getByRole('heading', { name: 'ERP 登录' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(screen.queryByText(/用户 User:/)).not.toBeInTheDocument();
  });
});
