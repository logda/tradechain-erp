import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceTabs } from '../app/app/_components/workspace-tabs';

let pathname = '/app';
vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

describe('WorkspaceTabs', () => {
  beforeEach(() => {
    sessionStorage.clear();
    pathname = '/app';
    history.replaceState({}, '', '/app');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps business query and page in one pathname tab', () => {
    pathname = '/app/sales/orders';
    history.replaceState({}, '', `${pathname}?keyword=Acme&page=3&role=admin&user=Admin`);
    const mounted = render(<WorkspaceTabs title="销售单列表" sessionKey="Admin:admin" />);
    expect(screen.getByRole('tab')).toHaveAttribute('href', `${pathname}?keyword=Acme&page=3`);
    history.replaceState({}, '', `${pathname}?keyword=Acme&page=4`);
    mounted.rerender(<WorkspaceTabs title="销售单列表" sessionKey="Admin:admin" />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab')).toHaveAttribute('href', `${pathname}?keyword=Acme&page=4`);
    expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'true');
  });

  it('restores scroll for the same query only after the real page registers', () => {
    pathname = '/app/sales/orders';
    history.replaceState({}, '', `${pathname}?page=3`);
    const mounted = render(<WorkspaceTabs title="销售单列表" sessionKey="Admin:admin" />);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 420 });
    fireEvent.scroll(window);
    pathname = '/app/sales/orders/103';
    history.replaceState({}, '', pathname);
    mounted.rerender(<WorkspaceTabs title="销售单详情" sessionKey="Admin:admin" />);
    vi.mocked(window.scrollTo).mockClear();
    pathname = '/app/sales/orders';
    history.replaceState({}, '', `${pathname}?page=3`);
    mounted.rerender(<WorkspaceTabs title="销售单列表" sessionKey="Admin:admin" registerCurrent={false} />);
    expect(window.scrollTo).not.toHaveBeenCalled();
    mounted.rerender(<WorkspaceTabs title="销售单列表" sessionKey="Admin:admin" />);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 420, left: 0, behavior: 'instant' });
    vi.mocked(window.scrollTo).mockClear();
    history.replaceState({}, '', `${pathname}?page=4`);
    mounted.rerender(<WorkspaceTabs title="销售单列表" sessionKey="Admin:admin" />);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('opens pages once, switches to an existing page, and closes the active tab', () => {
    const { rerender } = render(<WorkspaceTabs title="正式首页" sessionKey="Admin:admin" />);
    pathname = '/app/sales/orders';
    rerender(<WorkspaceTabs title="销售单列表" sessionKey="Admin:admin" />);
    pathname = '/app/sales/orders/103';
    rerender(<WorkspaceTabs title="销售单详情" sessionKey="Admin:admin" />);

    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: '销售单列表' })).toHaveAttribute('href', '/app/sales/orders');

    pathname = '/app/sales/orders';
    rerender(<WorkspaceTabs title="销售单列表" sessionKey="Admin:admin" />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    const close = screen.getByRole('button', { name: '关闭销售单列表页签' });
    expect(close).toHaveAttribute('href', '/app/sales/orders/103');
    close.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(close);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('keeps workspaces isolated between users and restores tabs after remount', () => {
    const { rerender, unmount } = render(<WorkspaceTabs title="正式首页" sessionKey="Admin:admin" />);
    pathname = '/app/purchase';
    rerender(<WorkspaceTabs title="采购中心" sessionKey="Admin:admin" />);
    unmount();

    const restored = render(<WorkspaceTabs title="采购中心" sessionKey="Admin:admin" />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    restored.unmount();

    render(<WorkspaceTabs title="采购中心" sessionKey="Leo:purchase" />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: '采购中心' })).toBeInTheDocument();
  });
});
