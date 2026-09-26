import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFormalTodos, type FormalTodoItem } from '../app/app/_lib/formal-todos';
import AppTodosPage from '../app/app/todos/page';

describe('AppTodosPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('auto-closes voided or cascaded todos before role filtering', () => {
    const injectedTodos = [
      {
        id: 'open-sales-1',
        docNo: 'S-OPEN-001',
        title: '销售单待处理',
        domain: 'sales',
        moduleLabel: '销售单',
        statusLabel: '待处理',
        ownerName: 'Zoe',
        href: '/app/sales/orders/1',
        priority: 'high',
        description: '正常待处理销售单。',
      },
      {
        id: 'closed-sales-1',
        docNo: 'S-CLOSED-001',
        title: '销售单已作废待办',
        domain: 'sales',
        moduleLabel: '销售单',
        statusLabel: '已联动作废',
        ownerName: 'Zoe',
        href: '/app/sales/orders/2',
        priority: 'high',
        description: '销售单作废后应自动从待办中心收口。',
        lifecycleStatus: 'auto_closed',
        closeReason: '销售单作废，采购与发货待办已联动收口',
      },
    ] satisfies Array<FormalTodoItem & {
      lifecycleStatus?: 'open' | 'auto_closed';
      closeReason?: string;
    }>;

    expect(
      getFormalTodos(
        {
          role: 'boss',
          user: 'Mia',
        },
        injectedTodos,
      ).map((todo) => todo.docNo),
    ).toEqual(['S-OPEN-001']);
  });

  it('renders cross-module todos for boss users from the live formal todo API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'quote-Q-RUNTIME-001',
            docNo: 'Q-RUNTIME-001',
            title: 'Runtime quote todo',
            domain: 'sales',
            moduleLabel: '报价',
            statusLabel: '待老板确认',
            ownerName: 'Zoe',
            href: '/app/sales/quotes/77',
            priority: 'high',
            description: 'Runtime API generated todo',
          },
          {
            id: 'purchase-P-RUNTIME-001',
            docNo: 'P-RUNTIME-001',
            title: 'Runtime purchase todo',
            domain: 'purchase',
            moduleLabel: '采购单',
            statusLabel: '待采购主管审批',
            ownerName: 'Leo',
            href: '/app/purchase-orders/99',
            priority: 'high',
            description: 'Runtime API generated purchase todo',
          },
        ],
        total: 2,
        closedTotal: 1,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<>{await AppTodosPage({})}</>);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/todos/formal?role=boss&user=Mia',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'boss',
          'x-erp-user': 'Mia',
        }),
      }),
    );
    expect(screen.getByRole('heading', { name: '正式待办中心' })).toBeInTheDocument();
    expect(screen.getByText('Q-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByText('P-RUNTIME-001')).toBeInTheDocument();
    expect(screen.getByText('消息待办 Todo: 02')).toBeInTheDocument();
    expect(screen.getByText('已自动收口')).toBeInTheDocument();
    expect(
      screen.getByText(
        '作废/联动作废待办不再占用待办数，相关单据会在来源详情页继续保留追溯入口。',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('S202607080003')).not.toBeInTheDocument();
  });

  it('filters sales todos to the current sales owner', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'quote-Q-ZOE-001',
            docNo: 'Q-ZOE-001',
            title: 'Zoe runtime quote todo',
            domain: 'sales',
            moduleLabel: '报价',
            statusLabel: '待老板确认',
            ownerName: 'Zoe',
            href: '/app/sales/quotes/1',
            priority: 'high',
            description: 'Only Zoe should see this sales todo.',
          },
        ],
        total: 1,
        closedTotal: 0,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <>
        {await AppTodosPage({
          searchParams: Promise.resolve({
            role: 'sales',
            user: 'Zoe',
          }),
        })}
      </>,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/todos/formal?role=sales&user=Zoe',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          'x-erp-role': 'sales',
          'x-erp-user': 'Zoe',
        }),
      }),
    );
    expect(screen.getByText('角色 Role: 销售')).toBeInTheDocument();
    expect(screen.getByText('Q-ZOE-001')).toBeInTheDocument();
    expect(screen.queryByText('P202607080002')).not.toBeInTheDocument();
    expect(screen.getByText('消息待办 Todo: 01')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '去经营驾驶舱' }),
    ).not.toBeInTheDocument();
  });

  it('filters purchase todos to purchase and operations work', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    render(
      <>
        {await AppTodosPage({
          searchParams: Promise.resolve({
            role: 'purchase',
            user: 'Leo',
          }),
        })}
      </>,
    );

    expect(screen.getByText('角色 Role: 采购')).toBeInTheDocument();
    expect(screen.getByText('待办暂时无法加载，请刷新页面重试。')).toBeInTheDocument();
    expect(screen.queryByText('P202607080002')).not.toBeInTheDocument();
    expect(screen.queryByText('Q202607080002')).not.toBeInTheDocument();
    expect(screen.getByText('消息待办 Todo: 00')).toBeInTheDocument();
  });
});
