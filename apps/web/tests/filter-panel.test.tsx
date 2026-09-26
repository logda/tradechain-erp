import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterPanel } from '../app/app/_components/filter-panel';

describe('FilterPanel', () => {
  it('starts collapsed and keeps filter input when closed and reopened', () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { container } = render(<FilterPanel title="查询筛选"><form onSubmit={submit}><label>关键词<input name="keyword" /></label><button>查询</button></form></FilterPanel>);
    const panel = container.querySelector('details')!;
    expect(panel.open).toBe(false);
    fireEvent.click(screen.getByText('查询筛选'));
    expect(panel.open).toBe(true);
    fireEvent.change(screen.getByLabelText('关键词'), { target: { value: '风扇' } });
    fireEvent.click(screen.getByText('查询筛选'));
    expect(panel.open).toBe(false);
    fireEvent.click(screen.getByText('查询筛选'));
    expect(panel.open).toBe(true);
    expect(screen.getByLabelText('关键词')).toHaveValue('风扇');
    fireEvent.submit(container.querySelector('form')!);
    expect(submit).toHaveBeenCalledOnce();
  });
});
