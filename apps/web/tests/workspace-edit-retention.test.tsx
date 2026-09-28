import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../app/app/_components/confirm-dialog';
import { AppShell, PersistentAppShell } from '../app/app/_components/app-shell';

const route = vi.hoisted(() => ({ pathname: '/app/admin/users', push: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname, useRouter: () => ({ push: route.push }) }));
vi.mock('../app/app/_components/live-todo-count', () => ({ LiveTodoCount: () => null }));
const session = { role: 'admin' as const, user: 'Admin', userId: 1, username: 'admin' };
function Editor() {
  const [lines, setLines] = useState(['']);
  return <form><input name="name" aria-label="姓名" />
    {lines.map((line, i) => <input key={i} aria-label={`产品${i + 1}`} value={line} onChange={e => setLines(lines.map((v, n) => n === i ? e.target.value : v))} />)}
    <button type="button" onClick={() => setLines([...lines, ''])}>加一行</button>
    <input name="files" type="file" aria-label="附件" />
  </form>;
}
function tree(title: string, content: React.ReactNode, account = session) {
  return <PersistentAppShell session={account}><AppShell title={title} session={account}>{content}</AppShell></PersistentAppShell>;
}
function move(path: string) {
  route.pathname = path;
  act(() => { history.pushState({}, '', path); });
}
beforeEach(() => {
  route.pathname = '/app/admin/users';
  history.replaceState({}, '', route.pathname);
  sessionStorage.clear();
  route.push.mockClear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(false);
});
afterEach(() => vi.restoreAllMocks());

describe('站内编辑内容保留与统一离开提示', () => {
  it('keeps uncontrolled fields, controlled extra lines and the actual selected file input across page switches', () => {
    const mounted = render(tree('用户管理', <Editor />));
    fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '新员工' } });
    fireEvent.click(screen.getByRole('button', { name: '加一行' }));
    fireEvent.change(screen.getByLabelText('产品2'), { target: { value: '未保存产品' } });
    const attachment = screen.getByLabelText('附件');
    const file = new File(['待上传'], '附件.txt');
    fireEvent.change(attachment, { target: { files: [file] } });
    move('/app/master-data/products');
    mounted.rerender(tree('产品库', <p>产品记录</p>));
    expect(screen.queryByRole('textbox', { name: '姓名' })).not.toBeInTheDocument();
    move('/app/admin/users');
    mounted.rerender(tree('用户管理', <Editor />));
    expect(screen.getByLabelText('姓名')).toHaveValue('新员工');
    expect(screen.getByLabelText('产品2')).toHaveValue('未保存产品');
    expect(screen.getByLabelText('附件')).toBe(attachment);
    expect((attachment as HTMLInputElement).files?.[0]).toBe(file);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('switches to an internal page without a discard warning', () => {
    render(tree('用户管理', <Editor />));
    fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '待提交' } });
    const link = screen.getByRole('link', { name: '产品库' });
    link.addEventListener('click', event => event.preventDefault());
    fireEvent.click(link);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('uses the existing system dialog for closing an edited page and keeps its tab when cancelled', async () => {
    sessionStorage.setItem('erp-workspace-tabs:admin:admin', JSON.stringify([{ href: '/app', label: '首页' }]));
    render(tree('用户管理', <Editor />));
    fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '保留' } });
    fireEvent.click(screen.getByRole('button', { name: '关闭用户管理页签' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveClass('erp-dialog');
    expect(dialog).toHaveTextContent('未保存');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('姓名')).toHaveValue('保留');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('warns before discarding an inactive edited tab and removes it only after confirmation', () => {
    const mounted = render(tree('用户管理', <Editor />));
    fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '后台编辑' } });
    move('/app'); mounted.rerender(tree('首页', <p>首页待办</p>));
    fireEvent.click(screen.getByRole('button', { name: '关闭用户管理页签' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('未保存');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '关闭并丢弃' }));
    expect(screen.queryByRole('tab', { name: '用户管理' })).not.toBeInTheDocument();
    move('/app/admin/users'); mounted.rerender(tree('用户管理', <Editor />));
    expect(screen.getByLabelText('姓名')).toHaveValue('');
  });

  it('guards full document exit for unsaved inactive editors, without storing field or file contents on disk', () => {
    const mounted = render(tree('用户管理', <Editor />));
    fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '保留在当前窗口' } });
    move('/app'); mounted.rerender(tree('首页', <p>首页待办</p>));
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(JSON.stringify(sessionStorage)).not.toContain('保留在当前窗口');
  });

  it('clears editing state when the actual account changes', () => {
    const mounted = render(tree('用户管理', <Editor />));
    fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '前账号内容' } });
    mounted.rerender(tree('用户管理', <Editor />, { ...session, username: 'other', userId: 15 }));
    expect(screen.getByLabelText('姓名')).toHaveValue('');
  });


  it('does not warn after a manual form resets successfully or the user restores the original input', () => {
    render(tree('用户管理', <Editor />));
    const field = screen.getByLabelText('姓名');
    fireEvent.input(field, { target: { value: '输入过' } });
    fireEvent.input(field, { target: { value: '' } });
    const reverted = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(reverted);
    expect(reverted.defaultPrevented).toBe(false);
    fireEvent.input(field, { target: { value: '提交完成' } });
    (field.closest('form') as HTMLFormElement).reset();
    const reset = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(reset);
    expect(reset.defaultPrevented).toBe(false);
  });

  it('hides pending business dialogs when their edited page is inactive', () => {
    const content = <><Editor /><ConfirmDialog title="业务确认" message="原单据的动作" onConfirm={() => {}} onCancel={() => {}} /></>;
    const mounted = render(tree('用户管理', content));
    fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '编辑' } });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('原单据');
    move('/app'); mounted.rerender(tree('首页', <p>首页待办</p>));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('clears an older edited page when freshly loaded permissions change even if the outer layout is reused', () => {
    const mounted = render(tree('用户管理', <Editor />));
    fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '旧权限内容' } });
    move('/app');
    const restricted = { ...session, role: 'sales' as const, accessScopes: { modules: ['sales'], actions: [], dataScope: 'own_sales' } };
    mounted.rerender(<PersistentAppShell session={session}><AppShell title="首页" session={restricted}><p>权限已更新</p></AppShell></PersistentAppShell>);
    expect(screen.queryByLabelText('姓名')).not.toBeInTheDocument();
  });

  it('does not keep a successful saved editor when leaving, so returning fetches a fresh page', () => {
    const mounted = render(tree('用户管理', <Editor />));
    fireEvent.input(screen.getByLabelText('姓名'), { target: { value: '保存后旧页面' } });
    screen.getByLabelText('姓名').closest('form')!.dataset.saveState = 'saved';
    move('/app'); mounted.rerender(tree('首页', <p>首页待办</p>));
    move('/app/admin/users'); mounted.rerender(tree('用户管理', <Editor />));
    expect(screen.getByLabelText('姓名')).toHaveValue('');
  });
});
