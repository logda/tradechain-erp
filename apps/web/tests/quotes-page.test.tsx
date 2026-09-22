import { render, screen } from '@testing-library/react';
import QuotesPage from '../app/quotes/page';

describe('QuotesPage', () => {
  it('renders the quote advanced filter form and default results', async () => {
    render(<>{await QuotesPage({ searchParams: Promise.resolve({}) })}</>);

    expect(screen.getByRole('heading', { name: '报价中心' })).toBeInTheDocument();
    expect(
      screen.getByText('管理报价草稿、客户来源、版本修订和老板确认'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('当前展示：报价高级筛选、结果摘要与确认状态预览'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('关键词')).toBeInTheDocument();
    expect(screen.getByLabelText('单号')).toBeInTheDocument();
    expect(screen.getByLabelText('状态')).toBeInTheDocument();
    expect(screen.getByText('高级筛选')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重置' })).toHaveAttribute(
      'href',
      '/quotes',
    );
    expect(screen.getByRole('link', { name: '新建报价' })).toHaveAttribute(
      'href',
      '/quotes/new',
    );
    expect(screen.getByText('Q202607080001')).toBeInTheDocument();
    expect(screen.getByText('Q202607080002')).toBeInTheDocument();
  });

  it('expands advanced filters and narrows results from search params', async () => {
    const { container } = render(
      <>
        {await QuotesPage({
          searchParams: Promise.resolve({
            customerName: 'Acme',
            sourceType: 'expo',
            bossConfirmed: 'yes',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByText('sourceType: expo')).toBeInTheDocument();
    expect(screen.getByText('bossConfirmed: yes')).toBeInTheDocument();
    expect(screen.getByText('Q202607080001')).toBeInTheDocument();
    expect(screen.queryByText('Q202607080002')).not.toBeInTheDocument();
  });

  it('treats invalid tri-state params as all instead of filtering them out', async () => {
    const { container } = render(
      <>
        {await QuotesPage({
          searchParams: Promise.resolve({
            bossConfirmed: 'bogus',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).not.toBe(true);
    expect(screen.queryByText('bossConfirmed: bogus')).not.toBeInTheDocument();
    expect(screen.getByText('Q202607080001')).toBeInTheDocument();
    expect(screen.getByText('Q202607080002')).toBeInTheDocument();
    expect(screen.getByText('XQ202607080003')).toBeInTheDocument();
  });
});
