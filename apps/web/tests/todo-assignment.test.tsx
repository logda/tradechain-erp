import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TodoGroup } from '../app/app/_components/todo-group';
import type { FormalTodoItem } from '../app/app/_lib/formal-todos';

const base = { domain: 'sales', moduleLabel: '销售单', statusLabel: '待审批', ownerName: '小李',
  href: '/app/sales/orders/1', priority: 'high', description: '' } as const;
const tasks: FormalTodoItem[] = [
  { ...base, id: 'follow', docNo: 'S-OLD', title: '销售单待主管审批', relation: 'following', nextAction: '审批销售单', handlerLabel: '销售主管' },
  { ...base, id: 'action', docNo: 'S-NEW', title: '销售单需修改', relation: 'action', nextAction: '修改后重新提交', handlerLabel: '小李' },
];

describe('待办分工与交期', () => {
  it('separates supervisor approval from the employee action without duplicating the total', () => {
    render(<TodoGroup title="销售待办" todos={tasks} />);
    expect(screen.getByText('共 2 条')).toBeInTheDocument();
    expect(screen.getByText('下一步：审批销售单')).toBeInTheDocument();
    expect(screen.getByText('当前处理人：销售主管')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '待我处理 1' }));
    expect(screen.getByText('S-NEW')).toBeInTheDocument();
    expect(screen.queryByText('S-OLD')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '我在跟进 1' }));
    expect(screen.getByText('S-OLD')).toBeInTheDocument();
    expect(screen.queryByText('S-NEW')).not.toBeInTheDocument();
  });

  it('shows a real handler username and preserves the role handler and total', () => {
    render(<TodoGroup title="销售待办" todos={[tasks[0], { ...tasks[1], userDisplayNames: { handlerLabel: 'new-sales' } }]} />);
    expect(screen.getByText('当前处理人：new-sales')).toBeInTheDocument();
    expect(screen.getByText('当前处理人：销售主管')).toBeInTheDocument();
    expect(screen.getByText('共 2 条')).toBeInTheDocument();
    expect(screen.queryByText('当前处理人：小李')).not.toBeInTheDocument();
  });

  it('paginates after selecting the relation and resets the page when switching', () => {
    const todos = Array.from({ length: 12 }, (_, i) => ({ ...tasks[i % 2], id: String(i), docNo: `S-${i}` }));
    render(<TodoGroup title="销售待办" todos={todos} />);
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    fireEvent.click(screen.getByRole('button', { name: '待我处理 6' }));
    const region = screen.getByRole('region', { name: '销售待办' });
    expect(within(region).getByText('S-1')).toBeInTheDocument();
    expect(within(region).queryByText('S-0')).not.toBeInTheDocument();
    fireEvent.click(within(region).getByRole('button', { name: '下一页' }));
    expect(within(region).getByText('S-11')).toBeInTheDocument();
  });

  it.each([[2, '还有 2 天'], [0, '今天到期'], [-5, '已逾期 5 天']])('shows calendar due days %s', (days, text) => {
    render(<TodoGroup title="采购待办" todos={[{ ...tasks[1], domain: 'purchase', dueDate: '2026-09-28', dueInDays: days as number }]} />);
    expect(screen.getByText(text as string)).toBeInTheDocument();
    expect(screen.getByText('交期：2026-09-28')).toBeInTheDocument();
  });
});
