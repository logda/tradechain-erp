import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell, PersistentAppShell } from '../app/app/_components/app-shell';

let pathname = '/app/sales/orders/new';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('../app/app/_components/live-todo-count', () => ({ LiveTodoCount: () => null }));
const session = { role: 'admin' as const, user: 'Admin' };
function page(form: React.ReactNode = <form><label>备注<input aria-label="备注" /></label></form>) {
  return <PersistentAppShell session={session}><AppShell title="销售单" session={session}>
    {form}<a href="/app/sales/orders">返回列表</a><a href="https://example.test/">离开网站</a>
  </AppShell></PersistentAppShell>;
}

beforeEach(() => {
  pathname = '/app/sales/orders/new';
  sessionStorage.clear();
  history.replaceState({}, '', pathname);
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('NavigationGuard', () => {
  it('switches internal pages without using a native confirmation', () => {
    render(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '尚未保存' } });
    const link = screen.getByRole('link', { name: '返回列表' });
    const bubbled = vi.fn((event: Event) => event.preventDefault());
    link.addEventListener('click', bubbled);
    fireEvent.click(link);
    expect(bubbled).toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it.each(['waiting', 'saving', 'skipped', 'error'])('warns before full document unload in %s state', state => {
    render(page(<form data-save-state={state}><input aria-label="备注" /></form>));
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('allows a saved form but includes selected files in the styled close warning', () => {
    render(page(<form data-save-state="saved"><input aria-label="附件" type="file" /></form>));
    const clean = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText('附件'), { target: { files: [new File(['x'], '未上传.pdf')] } });
    screen.getByLabelText('附件').closest('form')!.dataset.saveState = 'saved';
    fireEvent.click(screen.getByRole('button', { name: '关闭销售单页签' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('附件尚未上传');
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it.each([{ method: 'get' }, { className: 'erp-filter-form' }, { className: 'erp-todo-filters' }])('does not warn for query forms %j', props => {
    render(page(<form {...props}><input aria-label="备注" /></form>));
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '查找' } });
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it('ignores picker searches inside business forms', () => {
    render(page(<form><input type="search" aria-label="查找客户" /></form>));
    fireEvent.input(screen.getByLabelText('查找客户'), { target: { value: '客户A' } });
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });

  it('uses one system confirmation before leaving and protects new input again', () => {
    render(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '未保存' } });
    const link = screen.getByRole('link', { name: '离开网站' });
    link.addEventListener('click', event => event.preventDefault());
    fireEvent.click(link);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '离开并丢弃' }));
    const approved = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(approved);
    expect(approved.defaultPrevented).toBe(false);
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '新编辑' } });
    const fresh = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(fresh);
    expect(fresh.defaultPrevented).toBe(true);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('expires leave approval when the navigation remains in this document', async () => {
    render(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '未保存' } });
    const link = screen.getByRole('link', { name: '离开网站' });
    link.addEventListener('click', event => event.preventDefault());
    fireEvent.click(link);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '离开并丢弃' }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    const unload = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('retains the live editor across same document back and forward including an older untagged entry', async () => {
    history.replaceState({ legacy: true }, '', '/app/sales/orders');
    history.pushState({}, '', '/app/sales/orders/new');
    const mounted = render(page());
    await waitFor(() => expect(history.state?.__erpNavigation).toBeDefined());
    const editor = screen.getByLabelText('备注');
    fireEvent.input(editor, { target: { value: '返回仍在' } });
    history.back();
    await waitFor(() => expect(location.pathname).toBe('/app/sales/orders'));
    pathname = '/app/sales/orders'; mounted.rerender(page(<p>销售单列表</p>));
    history.forward();
    await waitFor(() => expect(location.pathname).toBe('/app/sales/orders/new'));
    pathname = '/app/sales/orders/new'; mounted.rerender(page());
    expect(screen.getByLabelText('备注')).toBe(editor);
    expect(editor).toHaveValue('返回仍在');
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('does not warn when closing an inactive clean tab', () => {
    sessionStorage.setItem('erp-workspace-tabs:Admin:admin', JSON.stringify([{ href: '/app/sales/orders?page=3', label: '销售单列表' }]));
    render(page());
    fireEvent.input(screen.getByLabelText('备注'), { target: { value: '编辑中' } });
    fireEvent.click(screen.getByRole('button', { name: '关闭销售单列表页签' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByLabelText('备注')).toHaveValue('编辑中');
  });

  it('restores the history functions after every unmount', async () => {
    const push = history.pushState, replace = history.replaceState;
    for (let i = 0; i < 2; i++) {
      const mounted = render(page());
      await waitFor(() => expect(history.pushState).not.toBe(push));
      mounted.unmount(); expect(history.pushState).toBe(push); expect(history.replaceState).toBe(replace);
    }
  });
});
