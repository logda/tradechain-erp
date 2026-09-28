import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveTodoCount } from '../app/app/_components/live-todo-count';
import { DataLoadError } from '../app/app/_components/data-load-error';
import Loading from '../app/app/loading';
import { MutationActionForm } from '../app/app/_components/mutation-action-form';

const navigation = vi.hoisted(() => ({ pathname: '/app/purchase', refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ refresh: navigation.refresh, push: vi.fn() }) }));
afterEach(() => { vi.unstubAllGlobals(); navigation.pathname = '/app/purchase'; navigation.refresh.mockClear(); });

describe('sidebar todo request lifecycle', () => {
  it('distinguishes loading, failure and a genuine zero after retry', async () => {
    let reject!: (error: Error) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; })).mockResolvedValue({ ok: true, json: async () => ({ count: 0 }) }));
    render(<LiveTodoCount />);
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
    await waitFor(() => expect(reject).toBeDefined());
    reject(new Error('offline'));
    await waitFor(() => expect(screen.getByText(/暂不可用/)).toBeInTheDocument());
    expect(screen.queryByText('消息待办 Todo: 00')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试待办数量' }));
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 00')).toBeInTheDocument());
  });

  it('refreshes count on navigation and refreshed server data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ count: 4 }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ count: 3 }) }).mockResolvedValue({ ok: true, json: async () => ({ count: 2 }) }));
    const { rerender } = render(<LiveTodoCount />);
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 04')).toBeInTheDocument());
    navigation.pathname = '/app/operations';
    rerender(<LiveTodoCount />);
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 03')).toBeInTheDocument());
    rerender(<LiveTodoCount refreshKey={2} />);
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 02')).toBeInTheDocument());
  });

  it('retries the server data block and exposes route loading', () => {
    render(<><DataLoadError label="销售统计" /><Loading /></>);
    fireEvent.click(screen.getByRole('button', { name: '重试销售统计' }));
    expect(navigation.refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toHaveTextContent('数据加载中');
  });

  it('updates an initial server count after a successful action with custom handling', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => ({ ok: true, json: async () => url === '/api/formal-todos/count' ? { count: 3 } : { status: 'approved' } })));
    render(<><LiveTodoCount initialCount={4} /><MutationActionForm endpoint="http://127.0.0.1:3001/api/sales-orders/104/approve" label="审批" fields={[]} onSuccess={() => undefined} /></>);
    expect(screen.getByText('消息待办 Todo: 04')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '审批' }));
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 03')).toBeInTheDocument());
  });

  it('revalidates a cached page count when a workspace tab is reopened', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 3 }) }));
    const { rerender } = render(<LiveTodoCount initialCount={4} />);
    navigation.pathname = '/app/sales';
    rerender(<LiveTodoCount initialCount={4} />);
    await waitFor(() => expect(screen.getByText('消息待办 Todo: 03')).toBeInTheDocument());
  });
});
