import { render, screen } from '@testing-library/react';
import SalesOrdersPage from '../app/sales-orders/page';

describe('SalesOrdersPage', () => {
  it('renders the sales order advanced filter form and default results', async () => {
    render(<>{await SalesOrdersPage({ searchParams: Promise.resolve({}) })}</>);

    expect(
      screen.getByRole('heading', { name: '销售订单中心' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('关键词')).toBeInTheDocument();
    expect(screen.getByLabelText('单号')).toBeInTheDocument();
    expect(screen.getByLabelText('状态')).toBeInTheDocument();
    expect(screen.getByText('高级筛选')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查询' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重置' })).toHaveAttribute(
      'href',
      '/sales-orders',
    );
    expect(screen.getByText('S202607080001')).toBeInTheDocument();
    expect(screen.getByText('S202607080002')).toBeInTheDocument();
  });

  it('expands advanced filters and narrows results from search params', async () => {
    const { container } = render(
      <>
        {await SalesOrdersPage({
          searchParams: Promise.resolve({
            keyword: 'Acme',
            approvalStatus: 'purchasing',
            hasAfterSales: 'yes',
            ownerName: 'Zoe',
            sourceMode: 'from_quote_with_inquiry',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).toBe(true);
    expect(screen.getByText('approvalStatus: purchasing')).toBeInTheDocument();
    expect(screen.getByText('hasAfterSales: yes')).toBeInTheDocument();
    expect(
      screen.getByText('sourceMode: from_quote_with_inquiry'),
    ).toBeInTheDocument();
    expect(screen.getByText('S202607080001')).toBeInTheDocument();
    expect(screen.queryByText('S202607080002')).not.toBeInTheDocument();
    expect(screen.queryByText('S202607080003')).not.toBeInTheDocument();
  });

  it('treats invalid source mode params as all instead of filtering them out', async () => {
    const { container } = render(
      <>
        {await SalesOrdersPage({
          searchParams: Promise.resolve({
            sourceMode: 'bogus',
          }),
        })}
      </>,
    );

    expect(container.querySelector('details')?.open).not.toBe(true);
    expect(screen.queryByText('sourceMode: bogus')).not.toBeInTheDocument();
    expect(screen.getByText('S202607080001')).toBeInTheDocument();
    expect(screen.getByText('S202607080002')).toBeInTheDocument();
    expect(screen.getByText('S202607080003')).toBeInTheDocument();
  });
});
