import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell, PersistentAppShell } from '../app/app/_components/app-shell';

let pathname = '/app/sales/orders/new';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('../app/app/_components/live-todo-count', () => ({ LiveTodoCount: () => null }));

function page(form: React.ReactNode = <form><label>备注<input aria-label="备注" /></label></form>) {
  return <PersistentAppShell session={{ role: 'admin', user: 'Admin' }}><AppShell title="销售单" session={{ role: 'admin', user: 'Admin' }}>
    {form}<a href="/app/sales/orders">返回列表</a>
  </AppShell></PersistentAppShell>;
}

beforeEach(() => {
  pathname = '/app/sales/orders/new';
  sessionStorage.clear();
  history.replaceState({}, '', pathname);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }));
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('NavigationGuard', () => {
  it('keeps an edited manual form when immediate navigation is cancelled', async () => {
    render(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '尚未保存' } });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByRole('link', { name: '返回列表' }).dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('未保存'));
    expect(screen.getByLabelText('备注')).toHaveValue('尚未保存');
  });

  it.each(['waiting', 'saving', 'skipped', 'error'])('warns before unloading a form in %s state', (state) => {
    render(page(<form data-save-state={state}><input aria-label="备注" /></form>));
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('allows a saved form but warns about selected files even when its fields are saved', () => {
    render(page(<form data-save-state="saved"><input aria-label="附件" type="file" /></form>));
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText('附件'), { target: { files: [new File(['x'], '未上传.pdf')] } });
    screen.getByLabelText('附件').closest('form')!.dataset.saveState = 'saved';
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    screen.getByRole('link', { name: '返回列表' }).dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('未上传附件'));
  });

  it.each([{ method: 'get' }, { className: 'erp-filter-form' }, { className: 'erp-todo-filters' }])('does not warn for a query form %j', (props) => {
    render(page(<form {...props}><input aria-label="备注" /></form>));
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '查找' } });
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it('ignores picker search inputs inside business forms', () => {
    render(page(<form><input type="search" aria-label="查找客户" /></form>));
    fireEvent.input(screen.getByLabelText('查找客户'), { target: { value: '客户A' } });
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it('consumes one agreed leave without a second unload warning and protects fresh input again', () => {
    render(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '未保存' } });
    vi.mocked(window.confirm).mockReturnValue(true);
    const link = screen.getByRole('link', { name: '返回列表' });
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    const approvedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(approvedUnload);
    expect(approvedUnload.defaultPrevented).toBe(false);
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '新编辑' } });
    const freshUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(freshUnload);
    expect(freshUnload.defaultPrevented).toBe(true);
  });

  it('resets leave approval when navigation does not leave the current document', async () => {
    render(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '未保存' } });
    vi.mocked(window.confirm).mockReturnValue(true);
    const link = screen.getByRole('link', { name: '返回列表' });
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('preserves the live form when cancelling back to an untagged history entry', async () => {
    history.replaceState({ legacy: true }, '', '/app/sales/orders');
    history.pushState({}, '', '/app/sales/orders/new');
    render(page());
    await waitFor(() => expect(history.state?.__erpNavigation).toBeDefined());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '保留旧历史前的输入' } });
    history.back();
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    await waitFor(() => expect(location.pathname).toBe('/app/sales/orders/new'));
    expect(screen.getByLabelText('备注')).toHaveValue('保留旧历史前的输入');
  });

  it('keeps the current tab in storage when closing it is cancelled', () => {
    sessionStorage.setItem('erp-workspace-tabs:Admin:admin', JSON.stringify([
      { href: '/app/sales/orders?page=3', label: '销售单列表' },
    ]));
    render(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '编辑中' } });
    fireEvent.click(screen.getByRole('button', { name: '关闭销售单页签' }));
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(JSON.parse(sessionStorage.getItem('erp-workspace-tabs:Admin:admin')!)).toHaveLength(2);
  });

  it('cancels browser back before Next can replace the form, and restores the current URL', async () => {
    pathname = '/app/sales/orders';
    history.replaceState({}, '', pathname);
    const mounted = render(page());
    await waitFor(() => expect(history.state?.__erpNavigation).toBeDefined());
    act(() => { history.pushState({}, '', '/app/sales/orders/new'); });
    pathname = '/app/sales/orders/new';
    mounted.rerender(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '不能丢失' } });
    const nextPopState = vi.fn();
    window.addEventListener('popstate', nextPopState);
    history.back();
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    await waitFor(() => expect(location.pathname).toBe('/app/sales/orders/new'));
    expect(nextPopState).not.toHaveBeenCalled();
    expect(screen.getByLabelText('备注')).toHaveValue('不能丢失');
    window.removeEventListener('popstate', nextPopState);
  });

  it('allows browser back and forward for saved forms and preserves the list query', async () => {
    pathname = '/app/sales/orders';
    history.replaceState({}, '', `${pathname}?keyword=Acme&page=3`);
    render(page(<form data-save-state="saved"><input aria-label="备注" /></form>));
    await waitFor(() => expect(history.state?.__erpNavigation).toBeDefined());
    act(() => { history.pushState({}, '', '/app/sales/orders/new'); });
    history.back();
    await waitFor(() => expect(location.search).toBe('?keyword=Acme&page=3'));
    history.forward();
    await waitFor(() => expect(location.pathname).toBe('/app/sales/orders/new'));
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('does not warn when closing an inactive tab from an edited form', () => {
    sessionStorage.setItem('erp-workspace-tabs:Admin:admin', JSON.stringify([
      { href: '/app/sales/orders?page=3', label: '销售单列表' },
    ]));
    render(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '编辑中' } });
    fireEvent.click(screen.getByRole('button', { name: '关闭销售单列表页签' }));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByLabelText('备注')).toHaveValue('编辑中');
  });

  it('restores global history functions after each mount', async () => {
    const push = history.pushState;
    const replace = history.replaceState;
    for (let count = 0; count < 2; count += 1) {
      const mounted = render(page());
      await waitFor(() => expect(history.pushState).not.toBe(push));
      mounted.unmount();
      expect(history.pushState).toBe(push);
      expect(history.replaceState).toBe(replace);
    }
  });
});
