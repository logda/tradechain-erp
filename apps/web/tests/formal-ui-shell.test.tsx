import { render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { AppShell } from '../app/app/_components/app-shell';

describe('formal responsive shell', () => {
  it('exposes one shared layout surface without changing navigation', () => {
    render(
      <AppShell title="测试页面" session={{ role: 'admin', user: 'Admin' }}>
        <p>页面内容</p>
      </AppShell>,
    );

    expect(screen.getByRole('main')).toHaveClass('erp-app', 'erp-shell');
    expect(screen.getByRole('complementary')).toHaveClass('erp-shell__sidebar');
    expect(screen.getByRole('navigation', { name: 'formal-app-nav' })).toHaveClass(
      'erp-shell__nav',
    );
    expect(screen.getByRole('heading', { name: '测试页面' })).toHaveClass('erp-shell__visually-hidden');
    const sidebar = screen.getByRole('complementary');
    expect(within(sidebar).getByText('角色 Role: 管理员')).toBeInTheDocument();
    expect(within(sidebar).getByText('用户 User: Admin')).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: /消息待办 Todo:/ })).toHaveAttribute('href', '/app/todos');
    expect(within(sidebar).getByRole('link', { name: '退出登录' })).toHaveAttribute('href', '/app/logout');
    expect(screen.queryByText('权限 Scope: 全业务权限')).not.toBeInTheDocument();
    expect(screen.getByText('页面内容').parentElement).toHaveClass('erp-shell__body');
    expect(screen.queryByRole('link', { name: '全链路验收中心' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '日志中心' })).toHaveAttribute('href', '/app/logs');
  });

  it('loads the live todo count on pages without a page-level count', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 17 }),
    }));
    render(<AppShell title="主数据中心" session={{ role: 'admin', user: 'Admin' }}><p>内容</p></AppShell>);
    await waitFor(() => expect(screen.getByRole('link', { name: '消息待办 Todo: 17' })).toBeInTheDocument());
    expect(screen.queryByText('消息待办 Todo: 05')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
