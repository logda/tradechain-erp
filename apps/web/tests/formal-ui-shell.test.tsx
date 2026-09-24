import { render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('heading', { name: '测试页面' })).toHaveClass(
      'erp-shell__title',
    );
    expect(screen.getByText('页面内容').parentElement).toHaveClass('erp-shell__body');
    expect(screen.queryByRole('link', { name: '全链路验收中心' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '日志中心' })).toHaveAttribute('href', '/app/logs');
  });
});
