import { render, screen } from '@testing-library/react';
import { FilterPanel } from '../app/app/_components/filter-panel';
import { FormalDataTable } from '../app/app/_components/formal-data-table';
import { FormalPagination } from '../app/app/_components/formal-pagination';
import { StatStrip } from '../app/app/_components/stat-strip';
import { WorktileCard } from '../app/app/_components/worktile-card';

describe('formal shared UI components', () => {
  it('gives filters and data tables one responsive card contract', () => {
    render(
      <>
        <FilterPanel>
          <input aria-label="关键词" />
        </FilterPanel>
        <FormalDataTable title="查询结果" total={1}>
          <table>
            <tbody>
              <tr>
                <td>记录</td>
              </tr>
            </tbody>
          </table>
        </FormalDataTable>
      </>,
    );

    expect(screen.getByRole('group', { name: '当前筛选' })).toHaveClass(
      'erp-card',
      'erp-filter-panel',
    );
    expect(screen.getByRole('region', { name: '查询结果' })).toHaveClass(
      'erp-card',
      'erp-data-table',
    );
    expect(screen.getByTestId('formal-table-scroll')).toHaveClass(
      'erp-data-table__body',
      'erp-table-scroll',
    );
  });

  it('uses shared compact navigation and summary surfaces', () => {
    render(
      <>
        <FormalPagination
          pathname="/app/sales/quotes"
          params={{}}
          page={1}
          pageSize={20}
          total={25}
          summaryLabel="测试"
        />
        <StatStrip items={[{ label: '全部', value: 25 }]} />
        <WorktileCard title="销售中心" href="/app/sales" description="销售工作台" />
      </>,
    );

    expect(screen.getByRole('navigation', { name: '测试分页' })).toHaveClass(
      'erp-pagination',
    );
    expect(screen.getByRole('link', { name: '下一页' })).toHaveClass(
      'erp-button',
      'erp-button--compact',
    );
    expect(screen.getByRole('region', { name: 'summary-strip' })).toHaveClass(
      'erp-stat-strip',
    );
    expect(screen.getByRole('article', { name: '销售中心' })).toHaveClass(
      'erp-card',
      'erp-worktile',
    );
  });
});
